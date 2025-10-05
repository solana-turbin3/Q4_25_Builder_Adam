import bs58 from 'bs58';
import prompt from 'prompt-sync';

const promptSync = prompt();

console.log("Enter your base58 private key:");
const base58Key = promptSync("Private key: ");

if (base58Key) {
    const wallet = bs58.decode(base58Key);
    console.log("Wallet bytes for Turbin3-wallet.json:");
    console.log(`[${Array.from(wallet).join(',')}]`);
} else {
    console.log("No key provided");
}