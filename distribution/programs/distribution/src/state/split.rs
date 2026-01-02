use anchor_lang::prelude::*;

/// Split State - defines how revenue is distributed for a specific content
#[account]
pub struct SplitState {
    /// Content identifier (32 bytes)
    pub content_id: [u8; 32],
    
    /// Creator's public key
    pub creator: Pubkey,
    
    /// Platform fee in basis points (e.g., 250 = 2.5%)
    pub platform_fee_bps: u16,
    
    /// Platform treasury address
    pub platform_treasury: Pubkey,
    
    /// List of collaborators and their shares
    pub collaborators: Vec<Collaborator>,
    
    /// Timestamp of last distribution
    pub last_distributed_ts: i64,
    
    /// Seed for PDA derivation
    pub seed: u64,
    
    /// PDA bump seed
    pub bump: u8,
}

impl SplitState {
    /// Base size without collaborators
    /// Discriminator (8) + [u8; 32] (32) + Pubkey (32) + u16 (2) 
    /// + Pubkey (32) + Vec length (4) + i64 (8) + u64 (8) + u8 (1)
    pub const BASE_LEN: usize = 8 + 32 + 32 + 2 + 32 + 4 + 8 + 8 + 1;
    
    /// Size per collaborator: Pubkey (32) + u16 (2)
    pub const COLLABORATOR_LEN: usize = 32 + 2;
    
    /// Calculate space needed for a given number of collaborators
    pub fn space(num_collaborators: usize) -> usize {
        Self::BASE_LEN + (Self::COLLABORATOR_LEN * num_collaborators)
    }
    
    /// PDA seed prefix
    pub const SEED_PREFIX: &'static [u8] = b"split";
    
    /// Validate that total basis points don't exceed 10000 (100%)
    pub fn validate_shares(&self) -> Result<()> {
        let total_collab_bps: u16 = self.collaborators
            .iter()
            .map(|c| c.share_bps)
            .sum();
        
        let total_bps = self.platform_fee_bps
            .checked_add(total_collab_bps)
            .ok_or(DistributionError::NumericalOverflow)?;
        
        require!(
            total_bps <= 10000,
            DistributionError::InvalidShareDistribution
        );
        
        Ok(())
    }
    
    /// Calculate creator's share after platform fee and collaborator shares
    pub fn calculate_creator_share(&self, total_amount: u64) -> Result<u64> {
        let platform_amount = self.calculate_platform_fee(total_amount)?;
        
        let mut remaining = total_amount
            .checked_sub(platform_amount)
            .ok_or(DistributionError::NumericalOverflow)?;
        
        // Subtract collaborator shares
        for collaborator in &self.collaborators {
            let collab_amount = total_amount
                .checked_mul(collaborator.share_bps as u64)
                .ok_or(DistributionError::NumericalOverflow)?
                .checked_div(10000)
                .ok_or(DistributionError::NumericalOverflow)?;
            
            remaining = remaining
                .checked_sub(collab_amount)
                .ok_or(DistributionError::NumericalOverflow)?;
        }
        
        Ok(remaining)
    }
    
    /// Calculate platform fee amount
    pub fn calculate_platform_fee(&self, total_amount: u64) -> Result<u64> {
        total_amount
            .checked_mul(self.platform_fee_bps as u64)
            .ok_or(DistributionError::NumericalOverflow)?
            .checked_div(10000)
            .ok_or(DistributionError::NumericalOverflow)
            .map_err(|_| DistributionError::NumericalOverflow.into())
    }
    
    /// Calculate collaborator's share amount
    pub fn calculate_collaborator_share(&self, total_amount: u64, share_bps: u16) -> Result<u64> {
        total_amount
            .checked_mul(share_bps as u64)
            .ok_or(DistributionError::NumericalOverflow)?
            .checked_div(10000)
            .ok_or(DistributionError::NumericalOverflow)
            .map_err(|_| DistributionError::NumericalOverflow.into())
    }
}

/// Collaborator with their revenue share
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Collaborator {
    /// Collaborator's public key
    pub pubkey: Pubkey,
    
    /// Share in basis points (e.g., 500 = 5%)
    pub share_bps: u16,
}

use crate::errors::DistributionError;
