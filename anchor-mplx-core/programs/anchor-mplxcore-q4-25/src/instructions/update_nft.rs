use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdateV1CpiBuilder,
    ID as CORE_PROGRAM_ID,
};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(Accounts)]
pub struct UpdateNft<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,
    #[account(mut, constraint = asset.data_is_empty() @ MPLXCoreError::AssetAlreadyInitialized)]
    pub asset: Signer<'info>,
    #[account(
        mut,
        constraint = collection.owner == &CORE_PROGRAM_ID @ MPLXCoreError::InvalidCollection,
        constraint = !collection.data_is_empty() @ MPLXCoreError::CollectionNotInitialized
    )]
    /// CHECK: This will also be checked by core
    pub collection: UncheckedAccount<'info>,
    #[account(
        seeds = [b"collection_authority", collection.key().as_ref()],
        bump = collection_authority.bump,
    )]
    pub collection_authority: Account<'info, CollectionAuthority>,
    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: This will also be checked by core
    pub core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateNft<'info> {
    pub fn update_nft(&mut self, new_collection: String) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            &self.collection.key().to_bytes(),
            &[self.collection_authority.bump],
        ]];

        UpdateV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.minter.to_account_info())
            .authority(Some(&self.collection_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .new_name(new_collection)
            .new_uri(self.collection_authority.nft_uri.clone())
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}