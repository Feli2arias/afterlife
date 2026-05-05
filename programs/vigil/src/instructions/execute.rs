use anchor_lang::prelude::*;
use crate::state::VaultConfig;
use crate::errors::VigError;

#[derive(Accounts)]
pub struct ExecuteDistribution<'info> {
    #[account(
        mut,
        seeds = [b"vigil", vault_config.owner.as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<ExecuteDistribution>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    require!(vault.is_active, VigError::VaultInactive);

    let now = Clock::get()?.unix_timestamp;
    require!(vault.is_expired(now), VigError::TimerNotExpired);

    vault.is_active = false;

    emit!(DistributionExecutedEvent {
        owner: vault.owner,
        timestamp: now,
        beneficiary_count: vault.beneficiaries.len() as u8,
    });

    Ok(())
}

#[event]
pub struct DistributionExecutedEvent {
    pub owner: Pubkey,
    pub timestamp: i64,
    pub beneficiary_count: u8,
}
