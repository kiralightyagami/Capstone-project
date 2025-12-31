use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer, System};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use anchor_spl::associated_token::AssociatedToken;
use access_mint::{
    program::AccessMint,
    cpi::accounts::MintAccess as AccessMintAccounts,
    cpi::mint_access,
};
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
    
    msg!("Payment of {} received from buyer: {}", payment_amount, ctx.accounts.buyer.key());
    
    // CPI to Access Mint program to mint access token to buyer
    mint_access(
        CpiContext::new(
            ctx.accounts.access_mint_program.to_account_info(),
            AccessMintAccounts {
                buyer: ctx.accounts.buyer.to_account_info(),
                payer: ctx.accounts.buyer.to_account_info(),
                access_mint_state: ctx.accounts.access_mint_state.to_account_info(),
                mint: ctx.accounts.access_mint.to_account_info(),
                mint_authority: ctx.accounts.mint_authority.to_account_info(),
                buyer_token_account: ctx.accounts.buyer_access_token_account.to_account_info(),
                token_program: ctx.accounts.access_token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        ),
    )?;
    
    // Store the access mint address in escrow
    escrow.access_mint_address = Some(ctx.accounts.access_mint.key());
    escrow.status = EscrowStatus::Completed;
    
    msg!("Access token minted to buyer: {}", ctx.accounts.buyer.key());
    
    // TODO: Add CPI to Revenue Split program to distribute funds from vault
    
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
    /// CHECK: Optional account, validated when SPL payment is used
    #[account(mut)]
    pub buyer_token_account: UncheckedAccount<'info>,
    
    /// Vault's SPL token account (for SPL payments)
    /// CHECK: Optional account, validated when SPL payment is used
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,
    
    /// Token program (for SPL payments)
    /// CHECK: Optional account, validated when SPL payment is used
    pub token_program: UncheckedAccount<'info>,
    
    // ============ Access Mint Program Accounts ============
    
    /// Access mint program
    pub access_mint_program: Program<'info, AccessMint>,
    
    /// Access mint state PDA
    /// CHECK: Validated by access mint program via CPI
    #[account(mut)]
    pub access_mint_state: UncheckedAccount<'info>,
    
    /// Access token mint
    #[account(mut)]
    pub access_mint: Account<'info, Mint>,
    
    /// Mint authority for access tokens
    /// CHECK: Validated by access mint program via CPI
    pub mint_authority: UncheckedAccount<'info>,
    
    /// Buyer's access token account (will be created if needed)
    #[account(mut)]
    pub buyer_access_token_account: UncheckedAccount<'info>,
    
    /// Token program for access mint
    pub access_token_program: Program<'info, Token>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// System program
    pub system_program: Program<'info, System>,
}
