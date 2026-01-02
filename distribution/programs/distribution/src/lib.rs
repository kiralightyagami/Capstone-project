#![allow(unexpected_cfgs, deprecated)]
use anchor_lang::prelude::*;

declare_id!("Czw384wkAHcNT7QpJC4y1DZ7LrKjyqsgTu8gHhsXtUpK");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

#[program]
pub mod distribution {
    use super::*;

    /// Initialize a new split configuration for content revenue sharing
    ///
    /// # Arguments
    /// * `content_id` - 32-byte unique identifier for the content
    /// * `platform_fee_bps` - Platform fee in basis points (max 1000 = 10%)
    /// * `collaborators` - List of collaborators and their share percentages
    /// * `seed` - Seed for PDA derivation
    pub fn initialize_split(
        ctx: Context<InitializeSplit>,
        content_id: [u8; 32],
        platform_fee_bps: u16,
        collaborators: Vec<state::Collaborator>,
        seed: u64,
    ) -> Result<()> {
        instructions::initialize_split::initialize_split(
            ctx,
            content_id,
            platform_fee_bps,
            collaborators,
            seed,
        )
    }

    /// Distribute funds from vault to all recipients according to split configuration
    /// Typically called via CPI from payment escrow program
    ///
    /// # Arguments
    /// * `amount` - Total amount to distribute
    pub fn distribute(ctx: Context<Distribute>, amount: u64) -> Result<()> {
        instructions::distribute::distribute(ctx, amount)
    }
}
