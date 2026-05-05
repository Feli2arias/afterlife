use anchor_lang::prelude::*;
use crate::state::VaultConfig;
use crate::errors::VigError;

#[derive(Accounts)]
pub struct ForceExpire<'info> {
    #[account(
        mut,
        seeds = [b"vigil", owner.key().as_ref()],
        bump = vault_config.bump,
        has_one = owner @ VigError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

// Backdates last_checkin so the vault appears expired — for demos and testing only
pub fn handler(ctx: Context<ForceExpire>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    require!(vault.is_active, VigError::VaultInactive);
    let interval_secs = vault.interval_days as i64 * 86_400;
    let grace_secs = vault.grace_period_days as i64 * 86_400;
    // Set checkin to just past the expiry window
    vault.last_checkin = Clock::get()?.unix_timestamp - interval_secs - grace_secs - 1;
    Ok(())
}
