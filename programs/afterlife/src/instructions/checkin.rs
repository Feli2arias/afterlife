use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{VaultConfig, CHECKIN_FEE_LAMPORTS};
use crate::errors::VigError;

#[derive(Accounts)]
pub struct Checkin<'info> {
    #[account(
        mut,
        seeds = [b"vigil", owner.key().as_ref()],
        bump = vault_config.bump,
        has_one = owner @ VigError::Unauthorized,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: protocol fee recipient, validated by seeds
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Checkin>) -> Result<()> {
    let vault = &mut ctx.accounts.vault_config;
    require!(vault.is_active, VigError::VaultInactive);

    // Anchor 1.0: CpiContext::new takes Pubkey, not AccountInfo
    system_program::transfer(
        CpiContext::new(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
            },
        ),
        CHECKIN_FEE_LAMPORTS,
    )?;

    vault.last_checkin = Clock::get()?.unix_timestamp;

    emit!(CheckinEvent {
        owner: ctx.accounts.owner.key(),
        timestamp: vault.last_checkin,
        next_deadline: vault.last_checkin + (vault.interval_days as i64 * 86_400),
    });

    Ok(())
}

#[event]
pub struct CheckinEvent {
    pub owner: Pubkey,
    pub timestamp: i64,
    pub next_deadline: i64,
}
