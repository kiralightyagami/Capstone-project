use anchor_lang::prelude::*;

declare_id!("Czw384wkAHcNT7QpJC4y1DZ7LrKjyqsgTu8gHhsXtUpK");

#[program]
pub mod distribution {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
