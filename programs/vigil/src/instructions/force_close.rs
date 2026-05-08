use anchor_lang::prelude::*;

/// Closes a vault_config account even if its data can't be deserialized.
/// Used to migrate accounts created by an older program version.
/// Security: verifies the account is at the correct PDA for this owner.
#[derive(Accounts)]
pub struct ForceClose<'info> {
    /// CHECK: manually verified via seeds below
    #[account(
        mut,
        seeds = [b"vigil", owner.key().as_ref()],
        bump,
    )]
    pub vault_config: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ForceClose>) -> Result<()> {
    let vault_config = &ctx.accounts.vault_config;
    let owner = &ctx.accounts.owner;

    // Drain lamports from vault_config to owner
    let lamports = vault_config.lamports();
    **vault_config.try_borrow_mut_lamports()? -= lamports;
    **owner.try_borrow_mut_lamports()? += lamports;

    // Zero out the data so the runtime knows it's closed
    let mut data = vault_config.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }

    Ok(())
}
