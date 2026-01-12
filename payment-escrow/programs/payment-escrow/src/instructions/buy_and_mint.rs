use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer, System};
use anchor_spl::token::{self, Mint, Token, Transfer as SplTransfer};
use anchor_spl::associated_token::AssociatedToken;
use access_mint::{
    program::AccessMint,
    cpi::accounts::MintAccess as AccessMintAccounts,
    cpi::mint_access,
};
use distribution::{
    program::Distribution,
    cpi::accounts::Distribute as DistributeAccounts,
    cpi::distribute,
};
use crate::state::*;
use crate::errors::*;

/// Main atomic instruction - handles payment to escrow vault
/// In a complete implementation, this would also CPI to Access Mint and Revenue Split programs
pub fn buy_and_mint<'info>(
    ctx: Context<'_, '_, '_, 'info, BuyAndMint<'info>>,
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
    
    // Transfer funds from escrow vault to distribution vault before distributing
    if escrow.payment_token_mint.is_none() {
        // SOL payment: Transfer from escrow vault to distribution vault
        let escrow_key = escrow.key();
        let vault_bump = ctx.bumps.vault;
        let vault_seeds = &[
            b"vault".as_ref(),
            escrow_key.as_ref(),
            &[vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];
        
        // Use system program transfer to properly handle account creation and rent
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.distribution_vault.to_account_info(),
                },
                signer_seeds,
            ),
            payment_amount,
        )?;
        
        msg!("Transferred {} lamports from escrow vault to distribution vault", payment_amount);
    } else {
        // SPL token payment: Transfer from escrow vault token account to distribution vault token account
        let escrow_key = escrow.key();
        let vault_bump = ctx.bumps.vault;
        let vault_seeds = &[
            b"vault".as_ref(),
            escrow_key.as_ref(),
            &[vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.distribution_vault_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            payment_amount,
        )?;
        
        msg!("Transferred {} tokens from escrow vault to distribution vault", payment_amount);
    }
    
    // CPI to Distribution program to distribute funds from distribution vault
    let remaining_accounts = ctx.remaining_accounts.to_vec();
    
    distribute(
        CpiContext::new(
            ctx.accounts.distribution_program.to_account_info(),
            DistributeAccounts {
                split_state: ctx.accounts.split_state.to_account_info(),
                vault: ctx.accounts.distribution_vault.to_account_info(),
                creator: ctx.accounts.creator.to_account_info(),
                platform_treasury: ctx.accounts.platform_treasury.to_account_info(),
                payment_token_mint: ctx.accounts.payment_token_mint.to_account_info(),
                vault_token_account: ctx.accounts.distribution_vault_token_account.to_account_info(),
                creator_token_account: ctx.accounts.creator_token_account.to_account_info(),
                platform_treasury_token_account: ctx.accounts.platform_treasury_token_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        )
        .with_remaining_accounts(remaining_accounts),
        payment_amount,
    )?;
    
    msg!("Funds distributed to creator, platform, and collaborators");
    
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
    /// CHECK: Validated and potentially created by access mint program via CPI
    #[account(mut)]
    pub buyer_access_token_account: UncheckedAccount<'info>,
    
    /// Token program for access mint
    pub access_token_program: Program<'info, Token>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    // ============ Distribution Program Accounts ============
    
    /// Distribution program
    pub distribution_program: Program<'info, Distribution>,
    
    /// Split state PDA (revenue split configuration)
    /// CHECK: Validated by distribution program via CPI
    #[account(mut)]
    pub split_state: UncheckedAccount<'info>,
    
    /// Distribution vault PDA (derived from split_state)
    /// CHECK: Vault is a PDA derived from split_state in the distribution program
    /// Validated by distribution program via CPI
    #[account(mut)]
    pub distribution_vault: UncheckedAccount<'info>,
    
    /// Distribution vault's SPL token account (for SPL payments)
    /// CHECK: Optional account, validated when SPL payment is used
    #[account(mut)]
    pub distribution_vault_token_account: UncheckedAccount<'info>,
    
    /// Creator account (receives their share)
    /// CHECK: Validated by distribution program via CPI
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,
    
    /// Platform treasury (receives platform fees)
    /// CHECK: Validated by distribution program via CPI
    #[account(mut)]
    pub platform_treasury: UncheckedAccount<'info>,
    
    /// Payment token mint (System::id() for SOL, token mint for SPL)
    /// CHECK: Used to determine payment type in distribution
    pub payment_token_mint: UncheckedAccount<'info>,
    
    /// Creator's token account (for SPL payments)
    /// CHECK: Optional, validated by distribution program when SPL payment is used
    #[account(mut)]
    pub creator_token_account: UncheckedAccount<'info>,
    
    /// Platform treasury token account (for SPL payments)
    /// CHECK: Optional, validated by distribution program when SPL payment is used
    #[account(mut)]
    pub platform_treasury_token_account: UncheckedAccount<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    // Remaining accounts: Collaborator accounts (SOL) or token accounts (SPL)
}
