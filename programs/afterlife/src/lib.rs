use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

pub use instructions::register::*;
pub use instructions::checkin::*;
pub use instructions::execute::*;
pub use instructions::claim::*;
pub use instructions::cancel::*;
pub use instructions::force_expire::*;
pub use instructions::force_close::*;
use state::Beneficiary;

declare_id!("4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu");

#[program]
pub mod vigil {
    use super::*;

    /// Owner sets up their will: beneficiaries (by email hash), check-in interval,
    /// and the backend authority pubkey that will verify heir identities at claim time.
    pub fn register(
        ctx: Context<Register>,
        beneficiaries: Vec<Beneficiary>,
        interval_days: u16,
        grace_period_days: u8,
        backend_authority: Pubkey,
    ) -> Result<()> {
        instructions::register::handler(ctx, beneficiaries, interval_days, grace_period_days, backend_authority)
    }

    /// Owner proves they are alive. Updates last_checkin and resets the timer.
    pub fn checkin(ctx: Context<Checkin>) -> Result<()> {
        instructions::checkin::handler(ctx)
    }

    /// Permissionless: anyone can call once the timer expires.
    /// Moves all delegated tokens from owner's ATA to a vault PDA.
    /// Records total amount so claim amounts are fixed from this point on.
    pub fn execute_distribution(ctx: Context<ExecuteDistribution>) -> Result<()> {
        instructions::execute::handler(ctx)
    }

    /// Called by backend authority after verifying heir's email via Privy.
    /// Transfers heir's allocation from vault to their wallet. Backend pays the gas.
    pub fn claim(ctx: Context<Claim>, email_hash: [u8; 32]) -> Result<()> {
        instructions::claim::handler(ctx, email_hash)
    }

    /// Owner cancels and recovers rent. Closes the vault_config account.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    /// Dev/demo only: backdates last_checkin to force expiry.
    pub fn force_expire(ctx: Context<ForceExpire>) -> Result<()> {
        instructions::force_expire::handler(ctx)
    }

    /// Migration: closes a vault_config that can't be deserialized (old schema).
    /// Only the owner can call this — verified via PDA seeds.
    pub fn force_close(ctx: Context<ForceClose>) -> Result<()> {
        instructions::force_close::handler(ctx)
    }
}
