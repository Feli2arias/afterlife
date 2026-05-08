use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use crate::state::VaultConfig;
use crate::errors::VigError;

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32])]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"vigil", vault_config.owner.as_ref()],
        bump = vault_config.bump,
        constraint = !vault_config.is_active @ VigError::NotExecuted,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    /// PDA that owns the vault token account
    #[account(
        seeds = [b"vault_auth", vault_config.key().as_ref()],
        bump,
    )]
    pub vault_authority: SystemAccount<'info>,

    /// Vault token account — source of heir's allocation
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Heir's wallet — no on-chain signature needed; backend verified email via Privy
    /// CHECK: pubkey provided by backend after JWT verification
    pub heir: UncheckedAccount<'info>,

    /// Heir's token account — created here if it doesn't exist (backend pays rent)
    #[account(
        init_if_needed,
        payer = backend_authority,
        associated_token::mint = token_mint,
        associated_token::authority = heir,
    )]
    pub heir_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Backend server keypair — verifies email identity off-chain, signs on-chain
    #[account(
        mut,
        address = vault_config.backend_authority @ VigError::InvalidAuthority,
    )]
    pub backend_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Claim>, email_hash: [u8; 32]) -> Result<()> {
    let (idx, share_bps) = {
        let vault = &ctx.accounts.vault_config;
        vault
            .beneficiaries
            .iter()
            .enumerate()
            .find(|(_, b)| b.email_hash == email_hash)
            .map(|(i, b)| (i, b.share_bps))
            .ok_or(VigError::BeneficiaryNotFound)?
    };

    require!(
        !ctx.accounts.vault_config.claimed_flags[idx],
        VigError::AlreadyClaimed
    );

    require!(
        ctx.accounts.vault_config.executed_token_mint == ctx.accounts.token_mint.key(),
        VigError::InvalidTokenMint
    );

    let executed_total = ctx.accounts.vault_config.executed_total;
    let decimals = ctx.accounts.token_mint.decimals;

    let amount = executed_total
        .checked_mul(share_bps as u64)
        .ok_or(VigError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(VigError::ArithmeticOverflow)?;

    require!(amount > 0, VigError::ZeroBalance);

    let vault_config_key = ctx.accounts.vault_config.key();
    let vault_auth_bump = ctx.bumps.vault_authority;
    let vault_auth_seeds: &[&[u8]] = &[b"vault_auth", vault_config_key.as_ref(), &[vault_auth_bump]];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.heir_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[vault_auth_seeds],
        ),
        amount,
        decimals,
    )?;

    ctx.accounts.vault_config.claimed_flags[idx] = true;

    emit!(ClaimedEvent {
        vault_config: ctx.accounts.vault_config.key(),
        email_hash,
        heir: ctx.accounts.heir.key(),
        token_mint: ctx.accounts.token_mint.key(),
        amount,
    });

    Ok(())
}

#[event]
pub struct ClaimedEvent {
    pub vault_config: Pubkey,
    pub email_hash: [u8; 32],
    pub heir: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
}
