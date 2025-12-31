use anchor_lang::prelude::*;

/// Access Mint State - stores metadata about the access token mint
#[account]
pub struct AccessMintState {
    /// The creator's public key
    pub creator: Pubkey,
    
    /// Content identifier (32 bytes)
    pub content_id: [u8; 32],
    
    /// The SPL token mint for access tokens
    pub mint: Pubkey,
    
    /// Mint authority (should be this PDA)
    pub mint_authority: Pubkey,
    
    /// Seed used for PDA derivation
    pub seed: u64,
    
    /// Total number of access tokens minted
    pub total_minted: u64,
    
    /// Timestamp when created
    pub created_ts: i64,
    
    /// PDA bump seed
    pub bump: u8,
}

impl AccessMintState {
    /// Size calculation for account allocation
    /// Discriminator (8) + Pubkey (32) + [u8; 32] (32) + Pubkey (32) 
    /// + Pubkey (32) + u64 (8) + u64 (8) + i64 (8) + u8 (1)
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
    
    /// PDA seed prefix for access mint state
    pub const SEED_PREFIX: &'static [u8] = b"access_mint_state";
    
    /// PDA seed prefix for mint authority
    pub const AUTHORITY_SEED_PREFIX: &'static [u8] = b"access_mint_authority";
}
