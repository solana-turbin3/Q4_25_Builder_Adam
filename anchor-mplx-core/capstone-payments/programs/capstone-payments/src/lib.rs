use anchor_lang::prelude::*;

declare_id!("4sRedkC6mpfbE4QHvnsFz8wAkbh5mrqQo1uk4mkbmR8D");

#[program]
pub mod capstone_payments {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
