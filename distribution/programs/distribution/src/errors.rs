use anchor_lang::prelude::*;

#[error_code]
pub enum DistributionError {
    #[msg("Invalid creator")]
    InvalidCreator,
    
    #[msg("Invalid content ID")]
    InvalidContentId,
    
    #[msg("Invalid platform fee")]
    InvalidPlatformFee,
    
    #[msg("Invalid share distribution - total exceeds 100%")]
    InvalidShareDistribution,
    
    #[msg("Too many collaborators")]
    TooManyCollaborators,
    
    #[msg("Invalid collaborator")]
    InvalidCollaborator,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
    
    #[msg("Invalid vault")]
    InvalidVault,
    
    #[msg("Invalid recipient")]
    InvalidRecipient,
    
    #[msg("Distribution already completed")]
    AlreadyDistributed,
}
