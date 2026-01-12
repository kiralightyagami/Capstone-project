use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer, System};
use anchor_spl::token::{self, Transfer as SplTransfer};
use crate::state::*;
use crate::errors::*;

/// Distribute funds from vault to all recipients
/// Called via CPI from payment escrow program
pub fn distribute<'info>(
    ctx: Context<'_, '_, '_, 'info, Distribute<'info>>,
    amount: u64,
) -> Result<()> {
    let split_state = &mut ctx.accounts.split_state;
    let clock = Clock::get()?;
    
    // Validate amounts
    require!(amount > 0, DistributionError::InsufficientFunds);
    
    // Calculate distribution amounts
    let platform_amount = split_state.calculate_platform_fee(amount)?;
    let creator_amount = split_state.calculate_creator_share(amount)?;
    
    // Get vault bump for signing
    let split_state_key = split_state.key();
    let vault_bump = ctx.bumps.vault;
    let vault_seeds = &[
        b"vault".as_ref(),
        split_state_key.as_ref(),
        &[vault_bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];
    
    // Determine if SOL or SPL payment
    let is_sol_payment = ctx.accounts.payment_token_mint.key() == System::id();
    
    if is_sol_payment {
        // Distribute SOL using system program transfers signed by vault PDA
        
        // Transfer to platform treasury
        if platform_amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.platform_treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                platform_amount,
            )?;
            msg!("Distributed {} lamports to platform", platform_amount);
        }
        
        // Transfer to collaborators
        for (i, collaborator) in split_state.collaborators.iter().enumerate() {
            let collab_amount = split_state.calculate_collaborator_share(amount, collaborator.share_bps)?;
            
            if collab_amount > 0 {
                // Get collaborator account from remaining accounts
                let collab_account = &ctx.remaining_accounts[i];
                require!(
                    collab_account.key() == collaborator.pubkey,
                    DistributionError::InvalidCollaborator
                );
                
                transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: collab_account.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    collab_amount,
                )?;
                msg!("Distributed {} lamports to collaborator {}", collab_amount, collaborator.pubkey);
            }
        }
        
        // Transfer remaining to creator
        if creator_amount > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                    signer_seeds,
                ),
                creator_amount,
            )?;
            msg!("Distributed {} lamports to creator", creator_amount);
        }
    } else {
        // Distribute SPL tokens
        require!(
            ctx.accounts.vault_token_account.key() != System::id(),
            DistributionError::InvalidVault
        );
        
        // Transfer to platform treasury
        if platform_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    SplTransfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.platform_treasury_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                platform_amount,
            )?;
            msg!("Distributed {} tokens to platform", platform_amount);
        }
        
        // Transfer to collaborators
        for (i, collaborator) in split_state.collaborators.iter().enumerate() {
            let collab_amount = split_state.calculate_collaborator_share(amount, collaborator.share_bps)?;
            
            if collab_amount > 0 {
                // Get collaborator token account from remaining accounts
                let collab_token_account = &ctx.remaining_accounts[i];
                
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        SplTransfer {
                            from: ctx.accounts.vault_token_account.to_account_info(),
                            to: collab_token_account.to_account_info(),
                            authority: ctx.accounts.vault.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    collab_amount,
                )?;
                msg!("Distributed {} tokens to collaborator", collab_amount);
            }
        }
        
        // Transfer remaining to creator
        if creator_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    SplTransfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                creator_amount,
            )?;
            msg!("Distributed {} tokens to creator", creator_amount);
        }
    }
    
    // Update last distributed timestamp
    split_state.last_distributed_ts = clock.unix_timestamp;
    
    msg!("Distribution completed: platform={}, creator={}, collaborators={}", 
        platform_amount, creator_amount, split_state.collaborators.len());
    
    Ok(())
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    /// Split state PDA
    #[account(
        mut,
        seeds = [
            SplitState::SEED_PREFIX,
            split_state.creator.as_ref(),
            split_state.content_id.as_ref(),
            split_state.seed.to_le_bytes().as_ref(),
        ],
        bump = split_state.bump,
    )]
    pub split_state: Account<'info, SplitState>,
    
    /// Vault holding the funds (SOL or SPL)
    /// CHECK: Vault PDA validated by seeds
    #[account(
        mut,
        seeds = [b"vault", split_state.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    
    /// Creator receiving their share
    /// CHECK: Creator validated from split_state
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,
    
    /// Platform treasury receiving platform fees
    /// CHECK: Platform treasury validated from split_state
    #[account(mut)]
    pub platform_treasury: UncheckedAccount<'info>,
    
    /// Payment token mint (System::id() for SOL)
    /// CHECK: Used to determine payment type
    pub payment_token_mint: UncheckedAccount<'info>,
    
    /// Vault token account for SPL payments
    /// CHECK: Optional, validated when SPL payment is used
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,
    
    /// Creator token account for SPL payments
    /// CHECK: Optional, validated when SPL payment is used
    #[account(mut)]
    pub creator_token_account: UncheckedAccount<'info>,
    
    /// Platform treasury token account for SPL payments
    /// CHECK: Optional, validated when SPL payment is used
    #[account(mut)]
    pub platform_treasury_token_account: UncheckedAccount<'info>,
    
    /// Token program for SPL payments
    /// CHECK: Optional, validated when SPL payment is used
    pub token_program: UncheckedAccount<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    // Remaining accounts: collaborator accounts (SOL) or token accounts (SPL)
}
