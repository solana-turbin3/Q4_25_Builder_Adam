use anchor_lang::prelude::*;

#[error_code]
pub enum PaymentError {
    #[msg("Merchant account is not initialized")]
    AccountNotInitialized,
    
    #[msg("Merchant account is inactive")]
    MerchantInactive,
    
    #[msg("Invalid token mint - only USDC accepted")]
    InvalidTokenMint,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("Invalid merchant ID")]
    InvalidMerchantId,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Platform is currently paused")]
    PlatformPaused,
    
    #[msg("Payment amount below minimum")]
    PaymentTooSmall,
    
    #[msg("Payment amount exceeds maximum")]
    PaymentTooLarge,

    #[msg("Calculation error")]
    CalculationError,
}