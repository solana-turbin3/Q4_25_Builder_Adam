use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MerchantAccount {
    #[max_len(64)]
    pub merchant_id: String,
    pub settlement_wallet: Pubkey,
    pub fee_percentage: u16,
    pub total_volume: u64,
    pub transaction_count: u64,
    pub created_at: u64,
    pub is_active: bool,
    pub bump: u8,
}