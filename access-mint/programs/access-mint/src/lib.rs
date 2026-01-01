#![allow(unexpected_cfgs, deprecated)]
use anchor_lang::prelude::*;

declare_id!("FmqUGBhdGHK9iPWbweoBXFBU2BY9g6C5ncfQstbXpDf6");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

#[program]
pub mod access_mint {
    use super::*;

    /// Initialize a new access token mint for content
    /// 
    /// # Arguments
    /// * `content_id` - 32-byte unique identifier for the content
    /// * `seed` - Seed for PDA derivation (allows multiple mints per content)
    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        content_id: [u8; 32],
        seed: u64,
    ) -> Result<()> {
        instructions::initialize_mint::initialize_mint(ctx, content_id, seed)
    }

    /// Mint an access token to a buyer
    /// Typically called via CPI from payment escrow program
    pub fn mint_access(ctx: Context<MintAccess>) -> Result<()> {
        instructions::mint_access::mint_access(ctx)
    }
}
