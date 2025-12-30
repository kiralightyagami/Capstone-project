#![allow(unexpected_cfgs, deprecated)]
use anchor_lang::prelude::*;

declare_id!("2T3AsDRbQdpLWaxEU5vbFXuzRHQnq7JT3wCQCmvdiKmJ");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

#[program]
pub mod payment_escrow {
    use super::*;

    /// Initialize a new escrow for a content purchase
    /// 
    /// # Arguments
    /// * `content_id` - 32-byte unique identifier for the content
    /// * `price` - Price in lamports (SOL) or token amount (SPL)
    /// * `payment_token_mint` - Optional SPL token mint (None for SOL payments)
    /// * `seed` - Trade nonce for uniqueness (allows multiple purchases)
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        content_id: [u8; 32],
        price: u64,
        payment_token_mint: Option<Pubkey>,
        seed: u64,
    ) -> Result<()> {
        instructions::initialize_escrow::initialize_escrow(
            ctx,
            content_id,
            price,
            payment_token_mint,
            seed,
        )
    }

    /// Execute payment and mint access token atomically
    /// 
    /// # Arguments
    /// * `payment_amount` - Amount to pay (must match escrow price)
    pub fn buy_and_mint(
        ctx: Context<BuyAndMint>,
        payment_amount: u64,
    ) -> Result<()> {
        instructions::buy_and_mint::buy_and_mint(ctx, payment_amount)
    }

    /// Cancel an escrow and refund the buyer
    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        instructions::cancel_escrow::cancel_escrow(ctx)
    }
}
