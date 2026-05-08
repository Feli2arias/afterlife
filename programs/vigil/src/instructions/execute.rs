use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
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

    /// Owner's token account — must have approved vault_config PDA as delegate
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = vault_config.owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    /// PDA that will own the vault token account
    #[account(
        seeds = [b"vault_auth", vault_config.key().as_ref()],
        bump,
    )]
    pub vault_authority: SystemAccount<'info>,

    /// Vault ATA — holds all tokens until each heir claims
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Anyone can execute once the timer expires (permissionless keeper)
    #[account(mut)]
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteDistribution>) -> Result<()> {
    let vault = &ctx.accounts.vault_config;

    require!(vault.is_active, VigError::VaultInactive);

    let now = Clock::get()?.unix_timestamp;
    require!(vault.is_expired(now), VigError::TimerNotExpired);

    let total_amount = ctx.accounts.owner_token_account.amount;
    require!(total_amount > 0, VigError::ZeroBalance);

    let owner_key = vault.owner;
    let bump = vault.bump;
    let token_mint_key = ctx.accounts.token_mint.key();
    let decimals = ctx.accounts.token_mint.decimals;

    // vault_config PDA is the approved SPL delegate — sign with its seeds
    let seeds: &[&[u8]] = &[b"vigil", owner_key.as_ref(), &[bump]];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.vault_config.to_account_info(),
            },
            &[seeds],
        ),
        total_amount,
        decimals,
    )?;

    let vault = &mut ctx.accounts.vault_config;
    vault.is_active = false;
    vault.executed_token_mint = token_mint_key;
    vault.executed_total = total_amount;

    emit!(DistributionExecutedEvent {
        owner: vault.owner,
        timestamp: now,
        token_mint: token_mint_key,
        total_amount,
    });

    Ok(())
}

#[event]
pub struct DistributionExecutedEvent {
    pub owner: Pubkey,
    pub timestamp: i64,
    pub token_mint: Pubkey,
    pub total_amount: u64,
}
