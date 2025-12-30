use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::*;

/// Initialize a new escrow account for a purchase
pub fn initialize_escrow(
    ctx: Context<InitializeEscrow>,
    content_id: [u8; 32],
    price: u64,
    payment_token_mint: Option<Pubkey>,
    seed: u64,
) -> Result<()> {
    require!(price > 0, EscrowError::InvalidPrice);
    
    let escrow = &mut ctx.accounts.escrow_state;
    let clock = Clock::get()?;
    
    // Initialize escrow state
    escrow.buyer = ctx.accounts.buyer.key();
    escrow.creator = ctx.accounts.creator.key();
    escrow.content_id = content_id;
    escrow.price = price;
    escrow.payment_token_mint = payment_token_mint;
    escrow.payment_amount = 0;
    escrow.access_mint_address = None;
    escrow.created_ts = clock.unix_timestamp;
    escrow.seed = seed;
    escrow.status = EscrowStatus::Initialized;
    escrow.bump = ctx.bumps.escrow_state;
    
    msg!("Escrow initialized for buyer: {}, creator: {}, content_id: {:?}, price: {}", 
        escrow.buyer, escrow.creator, content_id, price);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(content_id: [u8; 32], price: u64, payment_token_mint: Option<Pubkey>, seed: u64)]
pub struct InitializeEscrow<'info> {
    /// The buyer initiating the purchase
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// The creator who will receive payment
    /// CHECK: Creator account doesn't need to be validated beyond being a valid pubkey
    pub creator: UncheckedAccount<'info>,
    
    /// Escrow state PDA account
    #[account(
        init,
        payer = buyer,
        space = EscrowState::LEN,
        seeds = [
            EscrowState::SEED_PREFIX,
            buyer.key().as_ref(),
            content_id.as_ref(),
            seed.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub escrow_state: Account<'info, EscrowState>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
