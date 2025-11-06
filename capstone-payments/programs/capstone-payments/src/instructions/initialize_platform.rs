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

pub fn handler(
    ctx: Context<InitializePlatform>,
    platform_fee_bps: u16,
    min_payment_amount: u64,
    max_payment_amount: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.platform_config;
    
    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.treasury.key();
    config.platform_fee_bps = platform_fee_bps;
    config.min_payment_amount = min_payment_amount;
    config.max_payment_amount = max_payment_amount;
    config.is_paused = false;
    config.bump = ctx.bumps.platform_config;
    
    msg!("Platform initialized with fee: {} bps", platform_fee_bps);
    Ok(())
}
