# Capstone Payments

A trustless USDC payment processing protocol built on Solana with support for platform fees, merchant onboarding, customer tracking, and gasless transactions via Octane.

## Overview

PayApp is a Solana-based payment infrastructure that enables businesses to accept USDC payments without requiring end users to hold SOL for transaction fees. The protocol uses Program Derived Addresses (PDAs) to manage a trustless treasury and implements a dual fee structure that benefits both the platform and merchants.

## Key Features

### Trustless Treasury Management

- Platform fees are collected in a PDA-owned token account, not controlled by any single wallet
- Treasury funds can only be withdrawn by the platform authority through the claim instruction
- Regular token account (not ATA) owned by PlatformConfig PDA ensures maximum security

### Dual Fee Structure

- Platform fee: Configurable basis points applied to all transactions
- Merchant fee: Optional per-merchant fee percentage on top of platform fee
- Transparent fee calculation visible in all payment events

### Merchant Onboarding

- Merchants register with unique IDs and settlement wallets
- Configurable per-merchant fee percentages
- Payment and volume statistics tracked automatically
- Merchants can close accounts and reclaim rent

### Customer Tracking

- Automatic customer PDA creation on first payment
- Transaction history and volume tracking per customer
- Merchant-specific customer analytics

### Gasless Transaction Support

- Integration with Octane for fee-less user experience
- Users only need USDC, no SOL required
- SDK provides high-level gasless payment functions

## Architecture

### Program Derived Addresses (PDAs)

**PlatformConfig PDA**

- Seeds: `["platform_config"]`
- Stores global configuration, fee parameters, and treasury bump
- One per deployment

**Treasury Token Account**

- Seeds: `["treasury", "platform_config"]`
- Regular SPL token account owned by PlatformConfig PDA
- Collects platform fees from all payments

**Merchant PDA**

- Seeds: `["merchant", merchant_id]`
- Stores merchant-specific configuration and statistics
- One per registered merchant

**Customer PDA**

- Seeds: `["customer", customer_authority, merchant]`
- Tracks customer payment history with specific merchant
- Created on-demand during first payment

### Instructions

**initialize_platform**

- One-time setup by platform authority
- Creates PlatformConfig PDA and treasury token account
- Sets platform fee percentage and payment limits

**initialize_merchant**

- Registers new merchant with unique ID
- Configures settlement wallet and optional merchant fee
- Merchant pays for account rent

**process_payment**

- Transfers USDC from customer to merchant and platform
- Calculates and distributes fees to treasury and merchant
- Updates merchant and customer statistics
- Emits PaymentProcessed event

**claim_platform_fees**

- Allows platform authority to withdraw accumulated fees
- Uses PDA signing to transfer from treasury
- Only executable by platform authority

**close_merchant**

- Closes merchant account and refunds rent
- Validates settlement wallet ownership
- Only merchant settlement wallet can close

## Technology Stack

- **Framework**: Anchor 0.31.1
- **Runtime**: Solana
- **Token Standard**: SPL Token (USDC)
- **Gasless Provider**: Octane
- **Language**: Rust (program), TypeScript (SDK/tests)

## Program ID

```
3dijqDm6FT8iaLwBytsU9krYwVY3yovDuobcmt4o1yNr
```

## Development

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.31.1
- Node.js 18+

### Build

```bash
anchor build
```

### Test

```bash
anchor test
```

### Deploy

```bash
anchor deploy
```

## SDK Usage

### Initialize Platform

```typescript
import { initializePlatform } from "./sdk/payment";

await initializePlatform(
  connection,
  platformAuthority,
  usdcMint,
  50, // 0.5% platform fee
  1_000_000, // 1 USDC minimum
  1_000_000_000_000 // 1M USDC maximum
);
```

### Register Merchant

```typescript
import { initializeMerchant } from "./sdk/payment";

await initializeMerchant(
  connection,
  merchantAuthority,
  "merchant-001",
  merchantSettlementWallet,
  25 // 0.25% optional merchant fee
);
```

### Process Payment

```typescript
import { processPayment } from "./sdk/payment";

await processPayment(
  connection,
  customerKeypair,
  merchantId,
  merchantSettlementWallet,
  amount
);
```

### Process Gasless Payment

```typescript
import { executeGaslessTransaction } from "./sdk/octane";

const signature = await executeGaslessTransaction(
  connection,
  transaction,
  feePayer
);
```

## Security Considerations

- Platform treasury is controlled by code, not an admin wallet
- PDA signing prevents unauthorized withdrawals
- Off-curve PDA limitation addressed with regular token account
- Settlement wallet validation prevents merchant impersonation
- USDC mint validation ensures only authorized token accepted

## License

MIT

## Contact

Built by Adam for Turbin3 Q4 2025 Builder Cohort
