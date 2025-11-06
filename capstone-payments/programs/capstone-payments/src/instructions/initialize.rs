use anchor_lang::prelude::*;

use crate::state::{MerchantAccount, PlatformConfig};
use crate::errors::PaymentError;

#[derive(Accounts)]
#[instruction(merchant_id: String)]
pub struct InitializeMerchant<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + MerchantAccount::INIT_SPACE,
        seeds = [b"merchant", merchant_id.as_bytes().as_ref()],
        bump,
    )]
    pub merchant_account: Account<'info, MerchantAccount>,
    #[account(
        seeds = [PlatformConfig::SEED_PREFIX],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    /// CHECK: Account is validated in MerchantAccount - Merchant's settlement wallet
    pub settlement_wallet: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeMerchant<'info> {
    pub fn validate(&self, merchant_id: &String) -> Result<()> {
        // Check platform is not paused
        require!(!self.platform_config.is_paused, PaymentError::PlatformPaused);
        
        // Validate merchant ID
        require!(
            !merchant_id.is_empty() && merchant_id.len() <= 64, 
            PaymentError::InvalidMerchantId
        );
        
        Ok(())
    }

    pub fn initialize_account(&mut self, merchant_id: String, bump: u8) -> Result<()> {
        let merchant_account = &mut self.merchant_account;
        let clock = Clock::get()?.unix_timestamp as u64;

        merchant_account.merchant_id = merchant_id;
        merchant_account.settlement_wallet = *self.settlement_wallet.key;
        merchant_account.fee_percentage = 250; // Default 2.5%
        merchant_account.total_volume = 0;
        merchant_account.transaction_count = 0;
        merchant_account.created_at = clock;
        merchant_account.is_active = true;
        merchant_account.bump = bump;
        
        Ok(())
    }
}

pub fn handler(
    ctx: Context<InitializeMerchant>,
    merchant_id: String,
) -> Result<()> {
    ctx.accounts.validate(&merchant_id)?;
    let bump = ctx.bumps.merchant_account;
    ctx.accounts.initialize_account(merchant_id, bump)?;
    msg!("Merchant account initialized successfully");
    Ok(())
}
