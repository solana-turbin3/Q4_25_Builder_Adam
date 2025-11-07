use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

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
    /// CHECK: Treasury wallet for receiving platform fees
    pub treasury: AccountInfo<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = platform_config,
        seeds = [b"treasury", PlatformConfig::SEED_PREFIX],
        bump,
    )]
    pub platform_treasury_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializePlatform<'info> {
    pub fn initialize_platform(
        &mut self,
        platform_fee_bps: u16,
        min_payment_amount: u64,
        max_payment_amount: u64,
        platform_bump: u8,
        treasury_bump: u8,
    ) -> Result<()> {
        self.platform_config.authority = self.authority.key();
        self.platform_config.treasury = self.treasury.key();
        self.platform_config.platform_fee_bps = platform_fee_bps;
        self.platform_config.min_payment_amount = min_payment_amount;
        self.platform_config.max_payment_amount = max_payment_amount;
        self.platform_config.is_paused = false;
        self.platform_config.bump = platform_bump;
        self.platform_config.treasury_bump = treasury_bump;
        
        msg!("Platform initialized with fee: {} bps", platform_fee_bps);
        msg!("Treasury token account: {}", self.platform_treasury_usdc.key());
        Ok(())
    }
}

pub fn handler(
    ctx: Context<InitializePlatform>,
    platform_fee_bps: u16,
    min_payment_amount: u64,
    max_payment_amount: u64,
) -> Result<()> {
    let platform_bump = ctx.bumps.platform_config;
    let treasury_bump = ctx.bumps.platform_treasury_usdc;
    ctx.accounts.initialize_platform(
        platform_fee_bps,
        min_payment_amount,
        max_payment_amount,
        platform_bump,
        treasury_bump,
    )
}
