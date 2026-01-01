use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::errors::*;

/// Mint an access token to a buyer
/// This is typically called via CPI from the payment escrow program
pub fn mint_access(ctx: Context<MintAccess>) -> Result<()> {
    let access_mint_state = &mut ctx.accounts.access_mint_state;
    
    // Verify mint matches state
    require!(
        ctx.accounts.mint.key() == access_mint_state.mint,
        AccessMintError::InvalidMint
    );
    
    // Get PDA signer seeds
    let creator = access_mint_state.creator;
    let content_id = access_mint_state.content_id;
    let seed = access_mint_state.seed;
    let seed_bytes = seed.to_le_bytes();
    
    // Derive the bump manually since we're using UncheckedAccount
    let (expected_authority, authority_bump) = Pubkey::find_program_address(
        &[
            AccessMintState::AUTHORITY_SEED_PREFIX,
            creator.as_ref(),
            content_id.as_ref(),
            seed_bytes.as_ref(),
        ],
        ctx.program_id,
    );
    
    // Verify the mint authority matches
    require!(
        ctx.accounts.mint_authority.key() == expected_authority,
        AccessMintError::InvalidMintAuthority
    );
    
    let authority_seeds = &[
        AccessMintState::AUTHORITY_SEED_PREFIX,
        creator.as_ref(),
        content_id.as_ref(),
        seed_bytes.as_ref(),
        &[authority_bump],
    ];
    let signer_seeds = &[&authority_seeds[..]];
    
    // Mint 1 access token to buyer (decimals = 0, so amount = 1)
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            signer_seeds,
        ),
        1, // Mint 1 token (with 0 decimals)
    )?;
    
    // Update total minted count
    access_mint_state.total_minted = access_mint_state
        .total_minted
        .checked_add(1)
        .ok_or(AccessMintError::NumericalOverflow)?;
    
    msg!("Access token minted to buyer: {}, total minted: {}", 
        ctx.accounts.buyer.key(), access_mint_state.total_minted);
    
    Ok(())
}

#[derive(Accounts)]
pub struct MintAccess<'info> {
    /// The buyer receiving the access token
    /// CHECK: Can be any account, validated by caller
    pub buyer: UncheckedAccount<'info>,
    
    /// The payer for the token account creation (usually buyer or escrow program)
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// Access mint state PDA
    #[account(
        mut,
        seeds = [
            AccessMintState::SEED_PREFIX,
            access_mint_state.creator.as_ref(),
            access_mint_state.content_id.as_ref(),
            access_mint_state.seed.to_le_bytes().as_ref(),
        ],
        bump = access_mint_state.bump,
    )]
    pub access_mint_state: Account<'info, AccessMintState>,
    
    /// The mint account
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    /// Mint authority PDA
    /// CHECK: PDA validated manually in instruction
    pub mint_authority: UncheckedAccount<'info>,
    
    /// Buyer's token account (ATA)
    /// Will be created if it doesn't exist
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
