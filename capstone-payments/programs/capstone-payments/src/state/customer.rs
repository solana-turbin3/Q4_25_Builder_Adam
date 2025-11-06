use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CustomerAccount {
    pub customer: Pubkey,
    pub total_spent: u64,
    pub transaction_count: u64,
    pub last_payment: u64,
    pub bump: u8,
}