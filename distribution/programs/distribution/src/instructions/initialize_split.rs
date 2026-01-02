use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

/// Initialize a new split configuration for content
pub fn initialize_split(
    ctx: Context<InitializeSplit>,
    content_id: [u8; 32],
    platform_fee_bps: u16,
    collaborators: Vec<Collaborator>,
    seed: u64,
) -> Result<()> {
    // Validate platform fee (max 10%)
    require!(
        platform_fee_bps <= 1000,
        DistributionError::InvalidPlatformFee
    );
    
    // Validate collaborators count (max 10)
    require!(
        collaborators.len() <= 10,
        DistributionError::TooManyCollaborators
    );
    
    let split_state = &mut ctx.accounts.split_state;
    let clock = Clock::get()?;
    
    // Initialize split state
    split_state.content_id = content_id;
    split_state.creator = ctx.accounts.creator.key();
    split_state.platform_fee_bps = platform_fee_bps;
    split_state.platform_treasury = ctx.accounts.platform_treasury.key();
    split_state.collaborators = collaborators;
    split_state.last_distributed_ts = clock.unix_timestamp;
    split_state.seed = seed;
    split_state.bump = ctx.bumps.split_state;
    
    // Validate total shares don't exceed 100%
    split_state.validate_shares()?;
    
    msg!("Split initialized for creator: {}, content_id: {:?}", 
        ctx.accounts.creator.key(), content_id);
    msg!("Platform fee: {}bps, Collaborators: {}", 
        platform_fee_bps, split_state.collaborators.len());
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(content_id: [u8; 32], platform_fee_bps: u16, collaborators: Vec<Collaborator>, seed: u64)]
pub struct InitializeSplit<'info> {
    /// Creator who owns the content
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// Platform treasury that receives platform fees
    /// CHECK: Treasury address validated by authority
    pub platform_treasury: UncheckedAccount<'info>,
    
    /// Split state PDA
    #[account(
        init,
        payer = creator,
        space = SplitState::space(collaborators.len()),
        seeds = [
            SplitState::SEED_PREFIX,
            creator.key().as_ref(),
            content_id.as_ref(),
            seed.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub split_state: Account<'info, SplitState>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
