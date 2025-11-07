use anchor_lang::prelude::*;

use crate::state::MerchantAccount;
use crate::errors::PaymentError;

#[derive(Accounts)]
#[instruction(merchant_id: String)]
pub struct CloseMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = authority,
        seeds = [b"merchant", merchant_id.as_bytes()],
        bump = merchant_account.bump,
        constraint = merchant_account.settlement_wallet == authority.key() @ PaymentError::Unauthorized
    )]
    pub merchant_account: Account<'info, MerchantAccount>,
}

impl<'info> CloseMerchant<'info> {
    pub fn close_merchant(&mut self) -> Result<()> {
        msg!("Closing merchant account: {}", self.merchant_account.merchant_id);
        Ok(())
    }
}

pub fn handler(ctx: Context<CloseMerchant>, _merchant_id: String) -> Result<()> {
    ctx.accounts.close_merchant()
}
