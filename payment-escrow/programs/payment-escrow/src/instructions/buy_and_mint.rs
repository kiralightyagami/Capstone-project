use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token::{self, Token, TokenAccount, Transfer as SplTransfer};
use crate::state::*;
use crate::errors::*;

/// Main atomic instruction - handles payment to escrow vault
/// In a complete implementation, this would also CPI to Access Mint and Revenue Split programs
pub fn buy_and_mint(
    ctx: Context<BuyAndMint>,
    payment_amount: u64,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_state;
    
    // Validate escrow status
    require!(
        escrow.status == EscrowStatus::Initialized,
        EscrowError::InvalidEscrowStatus
    );
    
    // Validate payment amount matches price
    require!(
        payment_amount == escrow.price,
        EscrowError::InvalidPaymentAmount
    );
    
    // Validate buyer
    require!(
        ctx.accounts.buyer.key() == escrow.buyer,
        EscrowError::InvalidBuyer
    );
    
    // Transfer payment to vault
    if escrow.payment_token_mint.is_none() {
        // SOL payment
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            payment_amount,
        )?;
    } else {
        // SPL token payment
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.buyer_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            payment_amount,
        )?;
    }
    
    // Update escrow state
    escrow.payment_amount = payment_amount;
    escrow.status = EscrowStatus::Completed;
    
    msg!("Payment of {} received from buyer: {}", payment_amount, ctx.accounts.buyer.key());
    
    // TODO: In complete implementation, add CPIs to:
    // 1. Access Mint program to mint access token to buyer
    // 2. Revenue Split program to distribute funds from vault
    
    msg!("Buy and mint completed successfully");
    
    Ok(())
}

#[derive(Accounts)]
pub struct BuyAndMint<'info> {
    /// The buyer making the payment
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
    )]
    pub escrow_state: Account<'info, EscrowState>,
    
    /// Vault PDA to hold SOL payments
    /// CHECK: Vault is a PDA derived from escrow state
    #[account(
        mut,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    
    /// Buyer's SPL token account (for SPL payments)
    #[account(mut)]
    pub buyer_token_account: Option<Account<'info, TokenAccount>>,
    
    /// Vault's SPL token account (for SPL payments)
    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,
    
    /// Token program (for SPL payments)
    pub token_program: Option<Program<'info, Token>>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
