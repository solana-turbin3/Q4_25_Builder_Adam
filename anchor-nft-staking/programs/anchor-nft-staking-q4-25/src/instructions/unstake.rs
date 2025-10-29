use anchor_lang::prelude::*;
use mpl_core::{
    instructions::{RemovePluginV1CpiBuilder, UpdatePluginV1CpiBuilder},
    types::{FreezeDelegate, Plugin, PluginType},
    ID as CORE_PROGRAM_ID,
};

use crate::{
    errors::StakeError,
    state::{StakeAccount, StakeConfig, UserAccount},
};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    /// CHECK: This account is the NFT asset being unstaked
    pub asset: AccountInfo<'info>,
    #[account(
        mut,
        constraint = collection.owner == &CORE_PROGRAM_ID @ StakeError::InvalidCollection,
        constraint = !collection.data_is_empty() @ StakeError::CollectionNotInitialized,
    )]
    /// CHECK: This account represents the collection that the NFT belongs to
    pub collection: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key().as_ref()],
        bump = user_account.bump,   
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(
        mut,
        close = user,
        seeds = [b"stake".as_ref(), config.key().as_ref(), asset.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ StakeError::NotOwner,
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        mut,
        seeds = [b"config".as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StakeConfig>,
    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: Verified by address constraint
    pub core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Unstake<'info> {
    pub fn unstake(&mut self) -> Result<()> {
        require!(
            self.user_account.amount_staked > 0,
            StakeError::InvalidAsset
        );

        let time_staked = Clock::get()?
            .unix_timestamp
            .checked_sub(self.stake_account.staked_at)
            .ok_or(StakeError::InvalidAsset)?;

        require!(time_staked >= self.config.freeze_period as i64, StakeError::FreezePeriodNotPassed);

        let points_earned = (time_staked as u32)
            .checked_mul(self.config.points_per_stake as u32)
            .ok_or(StakeError::InvalidAsset)?;

        self.user_account.points = self.user_account.points.saturating_add(points_earned);
        
        self.user_account.amount_staked = self.user_account.amount_staked.saturating_sub(1);

        let config_signer_seeds: &[&[&[u8]]] = &[&[
            b"config",
            &[self.config.bump],
        ]];

        UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.user.to_account_info())
            .authority(Some(&self.config.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
            .invoke_signed(config_signer_seeds)?;

        RemovePluginV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.user.to_account_info())
            .authority(Some(&self.user.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin_type(PluginType::FreezeDelegate)
            .invoke()?;

        Ok(())
    }
}
