use anchor_lang::prelude::*;

use crate::state::PlatformConfig;

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [PlatformConfig::SEED_PREFIX],
        bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    /// CHECK: Treasury wallet validated by authority
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializePlatform<'info> {
    pub fn initialize_platform(
        &mut self,
        platform_fee_bps: u16,
        min_payment_amount: u64,
        max_payment_amount: u64,
        bump: u8,
    ) -> Result<()> {
        self.platform_config.authority = self.authority.key();
        self.platform_config.treasury = self.treasury.key();
        self.platform_config.platform_fee_bps = platform_fee_bps;
        self.platform_config.min_payment_amount = min_payment_amount;
        self.platform_config.max_payment_amount = max_payment_amount;
        self.platform_config.is_paused = false;
        self.platform_config.bump = bump;
        
        msg!("Platform initialized with fee: {} bps", platform_fee_bps);
        Ok(())
    }
}

pub fn handler(
    ctx: Context<InitializePlatform>,
    platform_fee_bps: u16,
    min_payment_amount: u64,
    max_payment_amount: u64,
) -> Result<()> {
    let bump = ctx.bumps.platform_config;
    ctx.accounts.initialize_platform(platform_fee_bps, min_payment_amount, max_payment_amount, bump)
}
