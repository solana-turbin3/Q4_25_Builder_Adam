import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  createAccount,
  mintTo,
  getAccount,
  getMint,
} from "@solana/spl-token";

describe("anchor-amm-q4-25", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;

  const provider = anchor.getProvider();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const seed = new anchor.BN(11);
  const fee = 200; // 2% fee (200 basis points)

  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [mintLp] = PublicKey.findProgramAddressSync(
    [Buffer.from("lp"), config.toBuffer()],
    program.programId
  );

  let mintX: PublicKey;
  let mintY: PublicKey;
  let vaultX: PublicKey;
  let vaultY: PublicKey;
  let userX: PublicKey;
  let userY: PublicKey;
  let userLp: PublicKey;

  before(async () => {
    // Create mint X
    mintX = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );

    // Create mint Y
    mintY = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );

    // Calculate vault addresses
    vaultX = getAssociatedTokenAddressSync(mintX, config, true);
    vaultY = getAssociatedTokenAddressSync(mintY, config, true);

    // Calculate user token accounts
    userX = getAssociatedTokenAddressSync(mintX, wallet.publicKey);
    userY = getAssociatedTokenAddressSync(mintY, wallet.publicKey);
    userLp = getAssociatedTokenAddressSync(mintLp, wallet.publicKey);

    // Create user token accounts and mint some tokens
    await createAccount(connection, wallet.payer, mintX, wallet.publicKey);
    await createAccount(connection, wallet.payer, mintY, wallet.publicKey);

    // Mint 1000 tokens of each to user
    await mintTo(connection, wallet.payer, mintX, userX, wallet.publicKey, 1_000_000_000); // 1000 tokens (6 decimals)
    await mintTo(connection, wallet.payer, mintY, userY, wallet.publicKey, 1_000_000_000); // 1000 tokens (6 decimals)
    
    console.log("\n🏦 Initial Setup Complete:");
    console.log("Mint X:", mintX.toBase58());
    console.log("Mint Y:", mintY.toBase58());
    console.log("Config:", config.toBase58());
    console.log("LP Mint:", mintLp.toBase58());
  });

  it("Initialize AMM", async () => {
    const tx = await program.methods
      .initialize(seed, fee, null)
      .accountsStrict({
        initializer: wallet.publicKey,
        mintX: mintX,
        mintY: mintY,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        config: config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Initialize AMM");
    console.log("Transaction signature:", tx);
    
    // Check config account
    const configAccount = await program.account.config.fetch(config);
    console.log("\n📊 Config Account:");
    console.log("  Seed:", configAccount.seed.toString());
    console.log("  Fee:", configAccount.fee, "basis points");
    console.log("  Locked:", configAccount.locked);
    console.log("  Mint X:", configAccount.mintX.toBase58());
    console.log("  Mint Y:", configAccount.mintY.toBase58());
  });

  it("Deposit liquidity", async () => {
    const depositAmount = new anchor.BN(100_000_000); // 100 tokens
    const maxX = new anchor.BN(100_000_000);
    const maxY = new anchor.BN(100_000_000);

    // Get balances before
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    
    console.log("\n💰 Before Deposit:");
    console.log("  User X balance:", Number(userXBefore.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYBefore.amount) / 1e6, "tokens");

    const tx = await program.methods
      .deposit(depositAmount, maxX, maxY)
      .accountsStrict({
        user: wallet.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: config,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Get balances after
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const userLpAfter = await getAccount(connection, userLp);
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);
    const lpMintAfter = await getMint(connection, mintLp);

    console.log("\n✅ Deposit Liquidity");
    console.log("Transaction signature:", tx);
    console.log("\n💰 After Deposit:");
    console.log("  User X balance:", Number(userXAfter.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYAfter.amount) / 1e6, "tokens");
    console.log("  User LP balance:", Number(userLpAfter.amount) / 1e6, "tokens");
    console.log("\n🏦 Vault Balances:");
    console.log("  Vault X:", Number(vaultXAfter.amount) / 1e6, "tokens");
    console.log("  Vault Y:", Number(vaultYAfter.amount) / 1e6, "tokens");
    console.log("  Total LP Supply:", Number(lpMintAfter.supply) / 1e6, "tokens");
  });

  it("Swaps tokens", async () => {
    const isX = true; // Swap X for Y
    const swapAmount = new anchor.BN(10_000_000); // 10 tokens
    const minOut = new anchor.BN(8_000_000); // Minimum 8 tokens out (accounting for fee and slippage)

    // Get balances before
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const vaultXBefore = await getAccount(connection, vaultX);
    const vaultYBefore = await getAccount(connection, vaultY);

    console.log("\n💱 Before Swap:");
    console.log("  User X balance:", Number(userXBefore.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYBefore.amount) / 1e6, "tokens");

    const tx = await program.methods
      .swap(isX, swapAmount, minOut)
      .accountsStrict({
        user: wallet.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: config,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("\n✅ Swap Tokens");
    console.log("Transaction signature:", tx);

    // Get balances after
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);

    console.log("\n💱 After Swap:");
    console.log("  User X balance:", Number(userXAfter.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYAfter.amount) / 1e6, "tokens");
    console.log("\n🏦 Vault Balances After Swap:");
    console.log("  Vault X:", Number(vaultXAfter.amount) / 1e6, "tokens");
    console.log("  Vault Y:", Number(vaultYAfter.amount) / 1e6, "tokens");
  });

  it("Withdraw liquidity", async () => {
    const lpToBurn = new anchor.BN(50_000_000); // Burn 50 LP tokens
    const minX = new anchor.BN(40_000_000); // Minimum 40 tokens X out
    const minY = new anchor.BN(40_000_000); // Minimum 40 tokens Y out

    // Get balances before
    const userXBefore = await getAccount(connection, userX);
    const userYBefore = await getAccount(connection, userY);
    const userLpBefore = await getAccount(connection, userLp);
    
    console.log("\n🏧 Before Withdraw:");
    console.log("  User X balance:", Number(userXBefore.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYBefore.amount) / 1e6, "tokens");
    console.log("  User LP balance:", Number(userLpBefore.amount) / 1e6, "tokens");

    const tx = await program.methods
      .withdraw(lpToBurn, minX, minY)
      .accountsStrict({
        user: wallet.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: config,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userX,
        userY: userY,
        userLp: userLp,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    // Get balances after
    const userXAfter = await getAccount(connection, userX);
    const userYAfter = await getAccount(connection, userY);
    const userLpAfter = await getAccount(connection, userLp);
    const vaultXAfter = await getAccount(connection, vaultX);
    const vaultYAfter = await getAccount(connection, vaultY);
    const lpMintAfter = await getMint(connection, mintLp);

    console.log("\n✅ Withdraw Liquidity");
    console.log("Transaction signature:", tx);
    console.log("\n🏧 After Withdraw:");
    console.log("  User X balance:", Number(userXAfter.amount) / 1e6, "tokens");
    console.log("  User Y balance:", Number(userYAfter.amount) / 1e6, "tokens");
    console.log("  User LP balance:", Number(userLpAfter.amount) / 1e6, "tokens");
    console.log("\n🏦 Vault Balances After Withdraw:");
    console.log("  Vault X:", Number(vaultXAfter.amount) / 1e6, "tokens");
    console.log("  Vault Y:", Number(vaultYAfter.amount) / 1e6, "tokens");
    console.log("  Total LP Supply:", Number(lpMintAfter.supply) / 1e6, "tokens");
  });
});