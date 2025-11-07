use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::{PlatformConfig, MerchantAccount, CustomerAccount};
use crate::errors::PaymentError;

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [PlatformConfig::SEED_PREFIX],
        bump = platform_config.bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CustomerAccount::INIT_SPACE,
        seeds = [b"customer", payer.key().as_ref()],
        bump,
    )]
    pub customer_account: Account<'info, CustomerAccount>,
    
    #[account(
        mut,
        seeds = [b"merchant", merchant_account.merchant_id.as_bytes()],
        bump = merchant_account.bump,
    )]
    pub merchant_account: Account<'info, MerchantAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = payer,
    )]
    pub customer_usdc: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = merchant_account.settlement_wallet,
    )]
    pub merchant_usdc: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"treasury", PlatformConfig::SEED_PREFIX],
        bump = platform_config.treasury_bump,
    )]
    pub platform_treasury_usdc: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Payment<'info> {
    pub fn process_payment(&mut self, amount: u64, bump: u8) -> Result<()> {
        let clock = Clock::get()?.unix_timestamp as u64;
        
        // Validations
        require!(self.merchant_account.is_active, PaymentError::MerchantInactive);
        require!(
            amount >= self.platform_config.min_payment_amount,
            PaymentError::PaymentTooSmall
        );
        require!(
            amount <= self.platform_config.max_payment_amount,
            PaymentError::PaymentTooLarge
        );
        require!(
            !self.platform_config.is_paused,
            PaymentError::PlatformPaused
        );
        
        // Calculate fees
        let platform_fee = amount
            .checked_mul(self.platform_config.platform_fee_bps as u64)
            .ok_or(PaymentError::CalculationError)?
            .checked_div(10_000)
            .ok_or(PaymentError::CalculationError)?;
            
        let merchant_fee = amount
            .checked_mul(self.merchant_account.fee_percentage as u64)
            .ok_or(PaymentError::CalculationError)?
            .checked_div(10_000)
            .ok_or(PaymentError::CalculationError)?;
        
        let total_fees = platform_fee
            .checked_add(merchant_fee)
            .ok_or(PaymentError::CalculationError)?;
            
        let merchant_amount = amount
            .checked_sub(total_fees)
            .ok_or(PaymentError::CalculationError)?;
        
        // Transfer platform fee to treasury
        let transfer_platform_fee_accounts = Transfer {
            from: self.customer_usdc.to_account_info(),
            to: self.platform_treasury_usdc.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        let transfer_platform_fee_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            transfer_platform_fee_accounts,
        );
        token::transfer(transfer_platform_fee_ctx, platform_fee)?;
        
        // Transfer merchant amount to merchant
        let transfer_merchant_accounts = Transfer {
            from: self.customer_usdc.to_account_info(),
            to: self.merchant_usdc.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        let transfer_merchant_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            transfer_merchant_accounts,
        );
        token::transfer(transfer_merchant_ctx, merchant_amount)?;
        
        // Update merchant stats
        self.merchant_account.total_volume = self.merchant_account.total_volume
            .checked_add(amount)
            .ok_or(PaymentError::CalculationError)?;
        self.merchant_account.transaction_count = self.merchant_account.transaction_count
            .checked_add(1)
            .ok_or(PaymentError::CalculationError)?;
        
        // Update customer account
        self.customer_account.total_spent = self.customer_account.total_spent
            .checked_add(amount)
            .ok_or(PaymentError::CalculationError)?;
        self.customer_account.transaction_count = self.customer_account.transaction_count
            .checked_add(1)
            .ok_or(PaymentError::CalculationError)?;
        self.customer_account.last_payment = clock;
        self.customer_account.bump = bump;
        
        msg!("Payment processed: {} USDC to merchant {}", amount, self.merchant_account.merchant_id);
        msg!("Platform fee: {}, Merchant fee: {}, Net to merchant: {}", platform_fee, merchant_fee, merchant_amount);
        
        Ok(())
    }
}

pub fn handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let bump = ctx.bumps.customer_account;
    ctx.accounts.process_payment(amount, bump)
}