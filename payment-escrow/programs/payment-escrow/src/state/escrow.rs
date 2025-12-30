use anchor_lang::prelude::*;

/// Escrow State Account - stores purchase metadata
#[account]
pub struct EscrowState {
    /// The buyer's public key
    pub buyer: Pubkey,
    
    /// The creator's public key who will receive payment
    pub creator: Pubkey,
    
    /// Content identifier (32 bytes)
    pub content_id: [u8; 32],
    
    /// Price in lamports or SPL token amount
    pub price: u64,
    
    /// Optional payment token mint (None = SOL, Some = SPL token)
    pub payment_token_mint: Option<Pubkey>,
    
    /// Amount actually paid (should match price)
    pub payment_amount: u64,
    
    /// Optional access mint address that was created
    pub access_mint_address: Option<Pubkey>,
    
    /// Timestamp when escrow was created
    pub created_ts: i64,
    
    /// Trade nonce for uniqueness (allows multiple purchases)
    pub seed: u64,
    
    /// Status of the escrow
    pub status: EscrowStatus,
    
    /// PDA bump seed
    pub bump: u8,
}

impl EscrowState {
    /// Size calculation for account allocation
    /// Discriminator (8) + Pubkey (32) + Pubkey (32) + [u8; 32] (32) + u64 (8) 
    /// + Option<Pubkey> (1 + 32) + u64 (8) + Option<Pubkey> (1 + 32) 
    /// + i64 (8) + u64 (8) + EscrowStatus (1) + u8 (1)
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 33 + 8 + 33 + 8 + 8 + 1 + 1;
    
    /// PDA seed prefix
    pub const SEED_PREFIX: &'static [u8] = b"escrow";
}

/// Escrow status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    /// Escrow initialized but payment not yet received
    Initialized,
    /// Payment received and access minted
    Completed,
    /// Escrow cancelled and refunded
    Cancelled,
}
