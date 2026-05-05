use anchor_lang::prelude::*;
use crate::state::VaultConfig;
use crate::errors::VigError;

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        seeds = [b"vigil", owner.key().as_ref()],
        bump = vault_config.bump,
        has_one = owner @ VigError::Unauthorized,
        close = owner
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(_ctx: Context<Cancel>) -> Result<()> {
    // `close = owner` returns rent to owner regardless of active state
    Ok(())
}
