use anchor_lang::prelude::*;

use crate::{error::MPLXCoreError, program::AnchorMplxcoreQ425, state::WhitelistedCreators};

#[derive(Accounts)]
pub struct WhitelistCreator<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This account is the creator being whitelisted. No validation needed as we're just storing the public key.
    pub creator: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = WhitelistedCreators::DISCRIMINATOR.len() + WhitelistedCreators::INIT_SPACE,
        seeds = [b"whitelist"],
        bump,
    )]
    pub whitelisted_creators: Account<'info, WhitelistedCreators>,
    pub system_program: Program<'info, System>,
    pub this_program: Program<'info, AnchorMplxcoreQ425>,
    /// CHECK: Validated by checking it matches the program data account derived from this_program
    #[account(
        constraint = this_program.programdata_address()? == Some(program_data.key()) @ MPLXCoreError::NotAuthorized
    )]
    pub program_data: Account<'info, ProgramData>,
}

impl<'info> WhitelistCreator<'info> {
    pub fn whitelist_creator(&mut self) -> Result<()> {
        self.whitelisted_creators.whitelist_creator(&self.creator)
    }
}