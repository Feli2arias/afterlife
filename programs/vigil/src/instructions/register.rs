use anchor_lang::prelude::*;
use crate::state::{VaultConfig, Beneficiary, VAULT_CONFIG_SIZE, MAX_BENEFICIARIES};
use crate::errors::VigError;

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(
        init,
        payer = owner,
        space = VAULT_CONFIG_SIZE,
        seeds = [b"vigil", owner.key().as_ref()],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Register>,
    beneficiaries: Vec<Beneficiary>,
    interval_days: u16,
    grace_period_days: u8,
) -> Result<()> {
    require!(!beneficiaries.is_empty(), VigError::NoBeneficiaries);
    require!(beneficiaries.len() <= MAX_BENEFICIARIES, VigError::TooManyBeneficiaries);
    require!(matches!(interval_days, 30 | 60 | 90), VigError::InvalidInterval);

    let total_bps: u16 = beneficiaries.iter().map(|b| b.share_bps).sum();
    require!(total_bps == 10_000, VigError::InvalidShares);

    let vault = &mut ctx.accounts.vault_config;
    vault.owner = ctx.accounts.owner.key();
    vault.beneficiaries = beneficiaries;
    vault.interval_days = interval_days;
    vault.grace_period_days = grace_period_days;
    vault.last_checkin = Clock::get()?.unix_timestamp;
    vault._reserved = 0;
    vault.is_active = true;
    vault.bump = ctx.bumps.vault_config;

    Ok(())
}
