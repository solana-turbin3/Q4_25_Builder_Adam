use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,           // Platform admin
    pub treasury: Pubkey,            // Where platform fees go
    pub platform_fee_bps: u16,       // Platform fee in basis points (e.g., 50 = 0.5%)
    pub min_payment_amount: u64,     // Minimum payment in lamports
    pub max_payment_amount: u64,     // Maximum payment in lamports
    pub is_paused: bool,             // Emergency pause
    pub bump: u8,
}

impl PlatformConfig {
    pub const SEED_PREFIX: &'static [u8] = b"platform_config";
}