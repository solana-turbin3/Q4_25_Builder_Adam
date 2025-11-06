use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("4sRedkC6mpfbE4QHvnsFz8wAkbh5mrqQo1uk4mkbmR8D");

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
}


