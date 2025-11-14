use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("B14zPMJLe5MBKgDuJd2pp6WxKYp8QM3MK7H5SLjEuBPP");

// USDC Mint addresses for different networks
// For testing, we'll store the USDC mint in PlatformConfig instead of hardcoding
// Devnet USDC: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
// Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

#[program]
pub mod capstone_payments {
    use super::*;

    /// Initialize the platform config (run once by platform authority)
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_fee_bps: u16,
        min_payment_amount: u64,
        max_payment_amount: u64,
    ) -> Result<()> {
        initialize_platform::handler(
            ctx,
            platform_fee_bps,
            min_payment_amount,
            max_payment_amount,
        )
    }
    
    /// Initialize a new merchant account
    pub fn initialize_merchant(
        ctx: Context<InitializeMerchant>,
        merchant_id: String,
    ) -> Result<()> {
        initialize::handler(ctx, merchant_id)
    }

    /// Process a USDC payment from customer to merchant
    pub fn process_payment(
        ctx: Context<Payment>,
        amount: u64,
    ) -> Result<()> {
        payment::handler(ctx, amount)
    }

    /// Claim accumulated platform fees
    pub fn claim_platform_fees(
        ctx: Context<ClaimPlatformFees>,
        amount: u64,
    ) -> Result<()> {
        claim::handler(ctx, amount)
    }

    /// Close a merchant account
    pub fn close_merchant(
        ctx: Context<CloseMerchant>,
        merchant_id: String,
    ) -> Result<()> {
        close::handler(ctx, merchant_id)
    }
}


