import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CapstonePayments } from "../target/types/capstone_payments";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMint, mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

// Generate unique merchant ID using timestamp
const merchantId = `merchant-${Date.now()}`;

console.log("\n🚀 Capstone Payments - Devnet Demo\n");

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.CapstonePayments as Program<CapstonePayments>;

// PDAs
const [platformConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    program.programId
);

const [merchantPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), Buffer.from(merchantId)],
    program.programId
);

const merchantWallet = Keypair.generate();
const customer = Keypair.generate();

console.log("📍 Program ID:", program.programId.toString());
console.log("📍 Platform Config PDA:", platformConfig.toString());
console.log("📍 Merchant PDA:", merchantPda.toString());
console.log("📍 Merchant ID:", merchantId);
console.log();

async function demo() {
    try {
        // Fetch platform config to get USDC mint
        const platformConfigAccount = await program.account.platformConfig.fetch(platformConfig);
        const usdcMint = platformConfigAccount.usdcMint;

        console.log("✅ Platform already initialized");
        console.log("💰 USDC Mint:", usdcMint.toString());
        console.log();

        // Airdrop SOL to merchant and customer
        console.log("💸 Airdropping SOL...");
        await provider.connection.requestAirdrop(merchantWallet.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(customer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create token accounts
        console.log("🪙 Setting up USDC accounts...");
        const merchantTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            merchantWallet,
            usdcMint,
            merchantWallet.publicKey
        );

        const customerTokenAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            customer,
            usdcMint,
            customer.publicKey
        );

        // Mint USDC to customer (you'll need mint authority - this might fail on devnet)
        console.log("💵 Minting USDC to customer...");
        // Note: This will only work if you have mint authority

        console.log();
        console.log("🏪 Initializing Merchant...");
        const merchantTx = await program.methods
            .initializeMerchant(merchantId)
            .accountsPartial({
                merchant: merchantPda,
                settlementWallet: merchantWallet.publicKey,
                authority: merchantWallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([merchantWallet])
            .rpc();

        console.log("✅ Merchant initialized!");
        console.log("🔗 Transaction:", `https://explorer.solana.com/tx/${merchantTx}?cluster=devnet`);
        console.log();

        const merchantAccount = await program.account.merchant.fetch(merchantPda);
        console.log("📊 Merchant Details:");
        console.log("   - Settlement Wallet:", merchantAccount.settlementWallet.toString());
        console.log("   - Fee Percentage:", merchantAccount.feePercentage / 100, "%");
        console.log("   - Active:", merchantAccount.isActive);
        console.log();

        // Get customer PDA
        const [customerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("customer"), customer.publicKey.toBuffer(), merchantPda.toBuffer()],
            program.programId
        );

        // Get treasury PDA
        const [treasuryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("treasury"), Buffer.from("platform_config")],
            program.programId
        );

        const amount = new anchor.BN(10_000_000); // 10 USDC

        console.log("💳 Processing Payment (10 USDC)...");
        const paymentTx = await program.methods
            .processPayment(amount)
            .accountsPartial({
                platformConfig,
                merchant: merchantPda,
                customer: customerPda,
                customerAuthority: customer.publicKey,
                merchantSettlementWallet: merchantWallet.publicKey,
                customerTokenAccount: customerTokenAccount.address,
                merchantTokenAccount: merchantTokenAccount.address,
                platformTreasury: treasuryPda,
                usdcMint: usdcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([customer])
            .rpc();

        console.log("✅ Payment processed!");
        console.log("🔗 Transaction:", `https://explorer.solana.com/tx/${paymentTx}?cluster=devnet`);
        console.log();

        const updatedMerchant = await program.account.merchant.fetch(merchantPda);
        const customerAccount = await program.account.customer.fetch(customerPda);

        console.log("📊 Updated Stats:");
        console.log("   - Merchant Volume:", updatedMerchant.totalVolume.toString());
        console.log("   - Merchant TX Count:", updatedMerchant.transactionCount.toString());
        console.log("   - Customer Spent:", customerAccount.totalSpent.toString());
        console.log("   - Customer TX Count:", customerAccount.transactionCount.toString());
        console.log();

        console.log("🎉 Demo Complete!");
        console.log();
        console.log("🔍 View transactions on Solana Explorer:");
        console.log("   Merchant Init:", `https://explorer.solana.com/tx/${merchantTx}?cluster=devnet`);
        console.log("   Payment:", `https://explorer.solana.com/tx/${paymentTx}?cluster=devnet`);

    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    }
}

demo();
