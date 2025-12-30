use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Invalid price amount")]
    InvalidPrice,
    
    #[msg("Invalid payment amount - does not match price")]
    InvalidPaymentAmount,
    
    #[msg("Escrow already completed")]
    EscrowAlreadyCompleted,
    
    #[msg("Escrow already cancelled")]
    EscrowAlreadyCancelled,
    
    #[msg("Escrow not in correct status")]
    InvalidEscrowStatus,
    
    #[msg("Invalid content ID")]
    InvalidContentId,
    
    #[msg("Invalid buyer")]
    InvalidBuyer,
    
    #[msg("Invalid creator")]
    InvalidCreator,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
    
    #[msg("Invalid seed")]
    InvalidSeed,
    
    #[msg("Invalid vault")]
    InvalidVault,
    
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
}
