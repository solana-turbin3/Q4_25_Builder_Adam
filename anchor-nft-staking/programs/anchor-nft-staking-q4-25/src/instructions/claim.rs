use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::state::{StakeConfig, UserAccount};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = reward_mint,
        associated_token::authority = user,
    )]
    pub rewards_ata: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"config".as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StakeConfig>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(
        mut,
        seeds = [b"rewards".as_ref(), config.key().as_ref()],
        bump = config.rewards_bump,
    )]
    pub reward_mint: Account<'info, Mint>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self) -> Result<()> {
        // Get the user's points
        let points = self.user_account.points;
        
        // Require that user has points to claim
        require!(points > 0, crate::errors::StakeError::InvalidAsset);

        // Mint reward tokens equal to points (1 point = 1 token with 0 decimals)
        let config_key = self.config.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"rewards",
            config_key.as_ref(),
            &[self.config.rewards_bump],
        ]];

        mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    mint: self.reward_mint.to_account_info(),
                    to: self.rewards_ata.to_account_info(),
                    authority: self.reward_mint.to_account_info(),
                },
                signer_seeds,
            ),
            points as u64,
        )?;

        // Reset user's points to 0
        self.user_account.points = 0;

        msg!("Claimed {} reward tokens", points);

        Ok(())
    }
}
