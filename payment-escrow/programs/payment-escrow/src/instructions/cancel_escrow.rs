use anchor_lang::prelude::*;
use anchor_lang::system_program::System;
use anchor_spl::token::{self, Token, Transfer as SplTransfer};
use crate::state::*;
use crate::errors::*;

/// Cancel an escrow and refund the buyer if payment was made
pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_state;
    
    // Validate escrow can be cancelled
    require!(
        escrow.status != EscrowStatus::Completed,
        EscrowError::EscrowAlreadyCompleted
    );
    
    require!(
        escrow.status != EscrowStatus::Cancelled,
        EscrowError::EscrowAlreadyCancelled
    );
    
    // Validate buyer is the one cancelling
    require!(
        ctx.accounts.buyer.key() == escrow.buyer,
        EscrowError::InvalidBuyer
    );
    
    // Refund if payment was made
    if escrow.payment_amount > 0 {
        let escrow_key = escrow.key();
        let bump = ctx.bumps.vault;
        let seeds = &[
            b"vault".as_ref(),
            escrow_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        if escrow.payment_token_mint.is_none() {
            // Refund SOL
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= escrow.payment_amount;
            **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += escrow.payment_amount;
            
            msg!("Refunded {} lamports to buyer", escrow.payment_amount);
        } else {
            // Refund SPL tokens
            // Validate that token accounts are provided
            require!(
                ctx.accounts.buyer_token_account.key() != System::id(),
                EscrowError::InvalidVault
            );
            require!(
                ctx.accounts.vault_token_account.key() != System::id(),
                EscrowError::InvalidVault
            );
            require!(
                ctx.accounts.token_program.key() == anchor_spl::token::ID,
                EscrowError::InvalidVault
            );
            
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    SplTransfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.buyer_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                escrow.payment_amount,
            )?;
            
            msg!("Refunded {} tokens to buyer", escrow.payment_amount);
        }
    }
    
    // Update escrow status
    escrow.status = EscrowStatus::Cancelled;
    
    msg!("Escrow cancelled for buyer: {}", ctx.accounts.buyer.key());
    
    Ok(())
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    /// The buyer cancelling the escrow
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// Escrow state PDA
    #[account(
        mut,
        seeds = [
            EscrowState::SEED_PREFIX,
            escrow_state.buyer.as_ref(),
            escrow_state.content_id.as_ref(),
            escrow_state.seed.to_le_bytes().as_ref(),
        ],
        bump = escrow_state.bump,
        close = buyer,
    )]
    pub escrow_state: Account<'info, EscrowState>,
    
    /// Vault PDA holding funds
    /// CHECK: Vault is a PDA derived from escrow state
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    
    /// Buyer's SPL token account (for SPL refunds)
    /// CHECK: Optional account, validated when SPL refund is needed
    #[account(mut)]
    pub buyer_token_account: UncheckedAccount<'info>,
    
    /// Vault's SPL token account (for SPL refunds)
    /// CHECK: Optional account, validated when SPL refund is needed
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,
    
    /// Token program (for SPL refunds)
    /// CHECK: Optional account, validated when SPL refund is needed
    pub token_program: UncheckedAccount<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
