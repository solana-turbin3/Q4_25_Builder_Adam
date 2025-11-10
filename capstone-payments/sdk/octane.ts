import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import axios from 'axios';
import base58 from 'bs58';

export interface OctaneConfig {
    feePayer: PublicKey;
    mint: PublicKey;
    feeAmount: number;
    tokenAccount: PublicKey;
}

/**
 * Load Octane node configuration
 * @param octaneUrl - Octane API endpoint (e.g., 'https://octane-devnet.breakroom.show/api')
 */
export async function loadOctaneConfig(octaneUrl: string): Promise<OctaneConfig> {
    const response = (await axios.get(octaneUrl, {
        headers: { 'Accept': 'application/json' }
    })).data;

    const feePayer = new PublicKey(response.feePayer);
    const mint = new PublicKey(response.endpoints.transfer.tokens[0].mint);
    const feeAmount = response.endpoints.transfer.tokens[0].fee;
    const tokenAccount = new PublicKey(response.endpoints.transfer.tokens[0].account);

    return { feePayer, mint, feeAmount, tokenAccount };
}

/**
 * Build a gasless transaction by prepending Octane fee payment
 * @param transaction - Your transaction (payment instruction)
 * @param userPublicKey - User's wallet public key
 * @param octaneConfig - Octane configuration
 * @param connection - Solana connection
 */
export async function buildGaslessTransaction(
    transaction: Transaction,
    userPublicKey: PublicKey,
    octaneConfig: OctaneConfig,
    connection: Connection
): Promise<Transaction> {
    const userTokenAccount = await getAssociatedTokenAddress(
        octaneConfig.mint,
        userPublicKey
    );

    // Prepend Octane fee payment as first instruction
    transaction.instructions.unshift(
        createTransferInstruction(
            userTokenAccount,
            octaneConfig.tokenAccount,
            userPublicKey,
            octaneConfig.feeAmount
        )
    );

    // Set Octane as fee payer
    transaction.feePayer = octaneConfig.feePayer;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    return transaction;
}

/**
 * Submit gasless transaction to Octane for signing and execution
 * @param transaction - Signed transaction (by user only, not fee payer)
 * @param octaneUrl - Octane API endpoint
 */
export async function submitGaslessTransaction(
    transaction: Transaction,
    octaneUrl: string
): Promise<{ signature: string }> {
    const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
    });

    const response = (await axios.post(`${octaneUrl}/transfer`, {
        transaction: base58.encode(serialized),
    })).data;

    return response;
}

/**
 * Complete gasless transaction flow
 * @param transaction - Your payment transaction
 * @param userPublicKey - User's wallet
 * @param signTransaction - Wallet adapter sign function
 * @param connection - Solana connection
 * @param octaneUrl - Octane API endpoint
 */
export async function executeGaslessTransaction(
    transaction: Transaction,
    userPublicKey: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    connection: Connection,
    octaneUrl: string = 'https://octane-devnet.breakroom.show/api'
): Promise<string> {
    // Load Octane config
    const octaneConfig = await loadOctaneConfig(octaneUrl);

    // Build gasless transaction
    const gaslessTx = await buildGaslessTransaction(
        transaction,
        userPublicKey,
        octaneConfig,
        connection
    );

    // User signs transaction
    const signedTx = await signTransaction(gaslessTx);

    // Submit to Octane
    const result = await submitGaslessTransaction(signedTx, octaneUrl);

    return result.signature;
}
