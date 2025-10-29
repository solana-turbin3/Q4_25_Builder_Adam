use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("GYF9RjJd7d64HXWw79xvZT89XEpPuMiJUt1FQLNVWfCh");

#[program]
pub mod anchor_escrow_q4_25 {
    use super::*;
    pub fn make(ctx: Context<Make>, seed: u64, offer_from_a: u64, receive: u64) -> Result<()> {
        ctx.accounts.deposit(offer_from_a)?;
        ctx.accounts.init_escrow(seed, receive, &ctx.bumps)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund_and_close_vault()
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.deposit(ctx.accounts.escrow.receive)?;
        ctx.accounts.withdraw_and_close_vault()
    }
}
