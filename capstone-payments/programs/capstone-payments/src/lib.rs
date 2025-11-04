use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use state::*;
use instructions::initialize::*;

declare_id!("4sRedkC6mpfbE4QHvnsFz8wAkbh5mrqQo1uk4mkbmR8D");

#[program]
pub mod capstone_payments {
    use super::*;

    pub fn initialize_merchant(
        ctx: Context<InitializeMerchant>,
        merchant_id: String,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, merchant_id)
    }
}


