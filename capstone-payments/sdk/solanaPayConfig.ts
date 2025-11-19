import { clusterApiUrl, Connection, PublicKey, Keypair } from '@solana/web3.js';
import { encodeURL, createQR, findReference, validateTransfer, FindReferenceError } from '@solana/pay';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BigNumber from 'bignumber.js';

/**
 * Solana Pay Configuration for Capstone Payments
 * This creates payment requests that integrate with your payment processor
 */

async function main() {
    // Connect to devnet
    console.log("1️⃣ Connecting to Solana devnet...");
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Your merchant's settlement wallet (use your wallet for testing)
    const recipient = new PublicKey('cQF1xw2i8bKZD2TpaNJx9nQVJuWRxmaggLWg3FAvjaA');

    // USDC mint on devnet
    const splToken = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    // Payment details
    const amount = new BigNumber(10); // 10 USDC
    const reference = Keypair.generate().publicKey; // Unique reference for this payment
    const label = 'Capstone Payments Demo';
    const message = 'Thank you for your purchase!';
    const memo = 'Capstone Payment #001';

    // Create the Solana Pay URL
    console.log("\n2️⃣ Creating Solana Pay URL...");
    const url = encodeURL({
        recipient,
        amount,
        splToken,
        reference,
        label,
        message,
        memo
    });

    console.log('\n📱 Payment URL:', url.toString());
    console.log('\n💡 Scan this QR code with a Solana Pay compatible wallet:\n');

    // Generate QR code (you'd display this to customer)
    const qrCode = createQR(url);
    console.log(qrCode);

    // Monitor for payment (in production, this would be webhook-based)
    console.log('\n3️⃣ Waiting for payment...');
    console.log('Reference:', reference.toBase58());

    let signatureInfo;
    try {
        // Poll for transaction (timeout after 60 seconds)
        signatureInfo = await findReference(connection, reference, { finality: 'confirmed' });
        console.log('\n✅ Payment detected!');
        console.log('Signature:', signatureInfo.signature);

        // Validate the transfer
        console.log('\n4️⃣ Validating transfer...');
        await validateTransfer(
            connection,
            signatureInfo.signature,
            {
                recipient,
                amount,
                splToken,
                reference,
            },
            { commitment: 'confirmed' }
        );

        console.log('✅ Payment validated!');
        console.log('\n💰 Transaction Details:');
        console.log(`   Amount: ${amount.toString()} USDC`);
        console.log(`   Recipient: ${recipient.toBase58()}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${signatureInfo.signature}?cluster=devnet`);

    } catch (error) {
        if (error instanceof FindReferenceError) {
            console.log('❌ Payment not found (timeout or not completed)');
        } else {
            console.error('❌ Error:', error);
        }
    }
}

main().catch(console.error);