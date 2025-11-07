use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::PlatformConfig;
use crate::errors::PaymentError;

#[derive(Accounts)]
pub struct ClaimPlatformFees<'info> {
    #[account(
        mut,
        constraint = authority.key() == platform_config.authority @ PaymentError::Unauthorized
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [PlatformConfig::SEED_PREFIX],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"treasury", PlatformConfig::SEED_PREFIX],
        bump = platform_config.treasury_bump,
    )]
    pub platform_treasury_usdc: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = authority,
    )]
    pub destination_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ClaimPlatformFees<'info> {
    pub fn claim_fees(&mut self, amount: u64) -> Result<()> {
        require!(
            amount <= self.platform_treasury_usdc.amount,
            PaymentError::InsufficientFunds
        );
        
        let transfer_accounts = Transfer {
            from: self.platform_treasury_usdc.to_account_info(),
            to: self.destination_usdc.to_account_info(),
            authority: self.platform_config.to_account_info(),
        };
        
        let seeds = &[
            PlatformConfig::SEED_PREFIX,
            &[self.platform_config.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            transfer_accounts,
            signer,
        );
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Platform fees claimed: {} USDC to {}", amount, self.authority.key());
        Ok(())
    }
}

pub fn handler(ctx: Context<ClaimPlatformFees>, amount: u64) -> Result<()> {
    ctx.accounts.claim_fees(amount)
}
