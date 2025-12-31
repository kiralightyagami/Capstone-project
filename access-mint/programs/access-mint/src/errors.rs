use anchor_lang::prelude::*;

#[error_code]
pub enum AccessMintError {
    #[msg("Invalid creator")]
    InvalidCreator,
    
    #[msg("Invalid content ID")]
    InvalidContentId,
    
    #[msg("Invalid mint")]
    InvalidMint,
    
    #[msg("Invalid buyer")]
    InvalidBuyer,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Mint authority mismatch")]
    InvalidMintAuthority,
    
    #[msg("Already minted to this buyer")]
    AlreadyMinted,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
}
