import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { CapstonePayments } from "../target/types/capstone_payments";
import { executeGaslessTransaction } from "./octane";

/**
 * Process a gasless USDC payment
 * User only needs USDC - Octane pays the SOL transaction fees
 */
export async function processPayment(
    program: Program<CapstonePayments>,
    connection: Connection,
    userPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    merchantId: string,
    paymentAmount: number,
    usdcMint: PublicKey,
    octaneUrl: string = 'https://octane-devnet.breakroom.show/api'
): Promise<string> {
    // Derive PDAs
    const [platformConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );

    const [merchantAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("merchant"), Buffer.from(merchantId)],
        program.programId
    );

    const [customerAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("customer"), userPublicKey.toBuffer()],
        program.programId
    );

    // Get token accounts
    const customerUsdc = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: userPublicKey
    });

    const merchantAccount = await program.account.merchantAccount.fetch(merchantAccountPDA);
    const merchantUsdc = anchor.utils.token.associatedAddress({
        mint: usdcMint,
        owner: merchantAccount.settlementWallet
    });

    const [platformTreasuryUsdc] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), Buffer.from("platform_config")],
        program.programId
    );

    // Build the payment transaction
    const transaction = await program.methods
        .processPayment(new anchor.BN(paymentAmount))
        .accounts({
            payer: userPublicKey,
            platformConfig: platformConfigPDA,
            customerAccount: customerAccountPDA,
            merchantAccount: merchantAccountPDA,
            usdcMint: usdcMint,
            customerUsdc: customerUsdc,
            merchantUsdc: merchantUsdc,
            platformTreasuryUsdc: platformTreasuryUsdc,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .transaction();

    // Execute gasless via Octane
    const signature = await executeGaslessTransaction(
        transaction,
        userPublicKey,
        signTransaction,
        connection,
        octaneUrl
    );

    return signature;
}

/**
 * Initialize a merchant account
 */
export async function initializeMerchant(
    program: Program<CapstonePayments>,
    merchantId: string,
    settlementWallet: PublicKey,
    payer: PublicKey
): Promise<string> {
    const [platformConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );

    const [merchantAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("merchant"), Buffer.from(merchantId)],
        program.programId
    );

    const tx = await program.methods
        .initializeMerchant(merchantId)
        .accountsStrict({
            payer: payer,
            merchantAccount: merchantAccountPDA,
            platformConfig: platformConfigPDA,
            settlementWallet: settlementWallet,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    return tx;
}

/**
 * Close a merchant account (must be called by settlement wallet)
 */
export async function closeMerchant(
    program: Program<CapstonePayments>,
    merchantId: string,
    authority: PublicKey
): Promise<string> {
    const [merchantAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("merchant"), Buffer.from(merchantId)],
        program.programId
    );

    const tx = await program.methods
        .closeMerchant(merchantId)
        .accountsStrict({
            authority: authority,
            merchantAccount: merchantAccountPDA,
        })
        .rpc();

    return tx;
}

/**
 * Claim platform fees (admin only)
 */
export async function claimPlatformFees(
    program: Program<CapstonePayments>,
    authority: PublicKey,
    destinationUsdc: PublicKey,
    usdcMint: PublicKey,
    amount: number
): Promise<string> {
    const [platformConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        program.programId
    );

    const [platformTreasuryUsdc] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), Buffer.from("platform_config")],
        program.programId
    );

    const tx = await program.methods
        .claimPlatformFees(new anchor.BN(amount))
        .accountsStrict({
            authority: authority,
            platformConfig: platformConfigPDA,
            usdcMint: usdcMint,
            platformTreasuryUsdc: platformTreasuryUsdc,
            destinationUsdc: destinationUsdc,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

    return tx;
}
