use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::state::*;

/// Initialize a new access token mint for a specific content
pub fn initialize_mint(
    ctx: Context<InitializeMint>,
    content_id: [u8; 32],
    seed: u64,
) -> Result<()> {
    let access_mint_state = &mut ctx.accounts.access_mint_state;
    let clock = Clock::get()?;
    
    // Initialize access mint state
    access_mint_state.creator = ctx.accounts.creator.key();
    access_mint_state.content_id = content_id;
    access_mint_state.mint = ctx.accounts.mint.key();
    access_mint_state.mint_authority = ctx.accounts.mint_authority.key();
    access_mint_state.seed = seed;
    access_mint_state.total_minted = 0;
    access_mint_state.created_ts = clock.unix_timestamp;
    access_mint_state.bump = ctx.bumps.access_mint_state;
    
    msg!("Access mint initialized for creator: {}, content_id: {:?}", 
        ctx.accounts.creator.key(), content_id);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(content_id: [u8; 32], seed: u64)]
pub struct InitializeMint<'info> {
    /// The creator who owns the content
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// Access mint state PDA
    #[account(
        init,
        payer = creator,
        space = AccessMintState::LEN,
        seeds = [
            AccessMintState::SEED_PREFIX,
            creator.key().as_ref(),
            content_id.as_ref(),
            seed.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub access_mint_state: Account<'info, AccessMintState>,
    
    /// The mint account for access tokens
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,
    
    /// Mint authority PDA
    /// CHECK: PDA used as mint authority
    #[account(
        seeds = [
            AccessMintState::AUTHORITY_SEED_PREFIX,
            creator.key().as_ref(),
            content_id.as_ref(),
            seed.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}
