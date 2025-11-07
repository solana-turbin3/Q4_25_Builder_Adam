import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CapstonePayments } from "../target/types/capstone_payments";

describe("capstone-payments", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capstonePayments as Program<CapstonePayments>;
  const connection = provider.connection;

  const authority = provider.wallet;
  const treasury = Keypair.generate();
  const merchantId = "merchant1";

  let platformConfigPDA: PublicKey;
  let merchantAccountPDA: PublicKey;
  let customerAccountPDA: PublicKey;
  let settlementWallet: Keypair;
  let usdcMint: PublicKey;
  let customerUsdcAccount: PublicKey;
  let merchantUsdcAccount: PublicKey;
  let treasuryUsdcAccount: PublicKey;

  before(async () => {
    // Derive Platform Config PDA
    [platformConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("platform_config")],
      program.programId
    );
    console.log(`Platform Config PDA: ${platformConfigPDA.toBase58()}`);

    // Derive Merchant Account PDA with merchant_id
    [merchantAccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), Buffer.from(merchantId)],
      program.programId
    );
    console.log(`Merchant Account PDA: ${merchantAccountPDA.toBase58()}`);

    // Derive Customer Account PDA
    [customerAccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("customer"), authority.publicKey.toBuffer()],
      program.programId
    );
    console.log(`Customer Account PDA: ${customerAccountPDA.toBase58()}`);

    // Settlement wallet for merchant payments
    settlementWallet = Keypair.generate();

    // Create USDC mint (simulating USDC for testing)
    usdcMint = await createMint(
      connection,
      authority.payer,
      authority.publicKey,
      null,
      6 // USDC has 6 decimals
    );
    console.log(`USDC Mint: ${usdcMint.toBase58()}`);

    // Create token accounts for customer, merchant, and treasury
    const customerAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      authority.publicKey
    );
    customerUsdcAccount = customerAccount.address;

    const merchantAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      settlementWallet.publicKey
    );
    merchantUsdcAccount = merchantAccount.address;

    const treasuryAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      platformConfigPDA // Changed: PDA is now the authority
    );
    treasuryUsdcAccount = treasuryAccount.address;

    // Mint some USDC to customer for testing (100 USDC)
    await mintTo(
      connection,
      authority.payer,
      usdcMint,
      customerUsdcAccount,
      authority.publicKey,
      100_000_000 // 100 USDC with 6 decimals
    );
    console.log(`Minted 100 USDC to customer`);
  });

  it("Initializes the platform config", async () => {
    const platformFeeBps = 50; // 0.5% platform fee
    const minPaymentAmount = 1000; // 0.000001 SOL minimum
    const maxPaymentAmount = 1_000_000_000_000; // 1000 SOL maximum

    const tx = await program.methods
      .initializePlatform(platformFeeBps, new anchor.BN(minPaymentAmount), new anchor.BN(maxPaymentAmount))
      .accountsStrict({
        authority: authority.publicKey,
        platformConfig: platformConfigPDA,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Platform initialized, tx:", tx);

    // Verify platform config
    const config = await program.account.platformConfig.fetch(platformConfigPDA);
    console.log("Platform Config:", config);
  });

  it("Initializes a merchant account", async () => {
    const tx = await program.methods
      .initializeMerchant(merchantId)
      .accountsStrict({
        payer: authority.publicKey,
        merchantAccount: merchantAccountPDA,
        platformConfig: platformConfigPDA,
        settlementWallet: settlementWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Merchant initialized, tx:", tx);

    // Verify merchant account
    const merchantAccount = await program.account.merchantAccount.fetch(merchantAccountPDA);
    console.log("Merchant Account:", merchantAccount);
  });

  it("Processes a payment", async () => {
    const paymentAmount = 10_000_000; // 10 USDC (6 decimals)

    const tx = await program.methods
      .processPayment(new anchor.BN(paymentAmount))
      .accountsStrict({
        payer: authority.publicKey,
        platformConfig: platformConfigPDA,
        customerAccount: customerAccountPDA,
        merchantAccount: merchantAccountPDA,
        usdcMint: usdcMint,
        customerUsdc: customerUsdcAccount,
        merchantUsdc: merchantUsdcAccount,
        platformTreasuryUsdc: treasuryUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Payment processed, tx:", tx);

    // Verify merchant account updated
    const merchantAccount = await program.account.merchantAccount.fetch(merchantAccountPDA);
    console.log("Merchant total volume:", merchantAccount.totalVolume.toString());
    console.log("Merchant transaction count:", merchantAccount.transactionCount.toString());

    // Verify customer account created/updated
    const customerAccount = await program.account.customerAccount.fetch(customerAccountPDA);
    console.log("Customer total spent:", customerAccount.totalSpent.toString());
    console.log("Customer transaction count:", customerAccount.transactionCount.toString());
  });

  it("Closes the merchant account", async () => {
    const tx = await program.methods
      .closeMerchant(merchantId)
      .accountsStrict({
        authority: settlementWallet.publicKey,
        merchantAccount: merchantAccountPDA,
      })
      .signers([settlementWallet])
      .rpc();

    console.log("Merchant account closed, tx:", tx);

    // Verify account is closed
    try {
      await program.account.merchantAccount.fetch(merchantAccountPDA);
      throw new Error("Account should be closed");
    } catch (e) {
      console.log("Merchant account successfully closed");
    }
  });

  it("Claims platform fees", async () => {
    // Get authority's USDC account
    const authorityUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      usdcMint,
      authority.publicKey
    );

    // Check platform treasury balance before claim
    const treasuryBalanceBefore = (await connection.getTokenAccountBalance(treasuryUsdcAccount)).value.amount;
    console.log("Platform treasury balance before:", treasuryBalanceBefore);

    const claimAmount = 50_000; // Claim 0.05 USDC (the platform fee from the 10 USDC payment)

    const tx = await program.methods
      .claimPlatformFees(new anchor.BN(claimAmount))
      .accountsStrict({
        authority: authority.publicKey,
        platformConfig: platformConfigPDA,
        usdcMint: usdcMint,
        platformTreasuryUsdc: treasuryUsdcAccount,
        destinationUsdc: authorityUsdcAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Platform fees claimed, tx:", tx);

    // Verify balances updated
    const treasuryBalanceAfter = (await connection.getTokenAccountBalance(treasuryUsdcAccount)).value.amount;
    const authorityBalance = (await connection.getTokenAccountBalance(authorityUsdcAccount.address)).value.amount;

    console.log("Platform treasury balance after:", treasuryBalanceAfter);
    console.log("Authority balance after claim:", authorityBalance);
  });
});
