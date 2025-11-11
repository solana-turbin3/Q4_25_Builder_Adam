use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,           // Platform admin
    pub treasury: Pubkey,            // Where platform fees go (wallet for claiming)
    pub usdc_mint: Pubkey,           // Authorized USDC mint address
    pub platform_fee_bps: u16,       // Platform fee in basis points (e.g., 50 = 0.5%)
    pub min_payment_amount: u64,     // Minimum payment in lamports
    pub max_payment_amount: u64,     // Maximum payment in lamports
    pub is_paused: bool,             // Emergency pause
    pub bump: u8,                    // PDA bump for platform_config
    pub treasury_bump: u8,           // PDA bump for treasury token account
}

impl PlatformConfig {
    pub const SEED_PREFIX: &'static [u8] = b"platform_config";
    pub const TREASURY_SEED_PREFIX: &'static [u8] = b"treasury";
}