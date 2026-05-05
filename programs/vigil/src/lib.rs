use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

pub use instructions::register::*;
pub use instructions::checkin::*;
pub use instructions::execute::*;
pub use instructions::cancel::*;
pub use instructions::force_expire::*;
use state::Beneficiary;

declare_id!("4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu");

#[program]
pub mod vigil {
    use super::*;

    pub fn register(
        ctx: Context<Register>,
        beneficiaries: Vec<Beneficiary>,
        interval_days: u16,
        grace_period_days: u8,
    ) -> Result<()> {
        instructions::register::handler(ctx, beneficiaries, interval_days, grace_period_days)
    }

    pub fn checkin(ctx: Context<Checkin>) -> Result<()> {
        instructions::checkin::handler(ctx)
    }

    pub fn execute_distribution(ctx: Context<ExecuteDistribution>) -> Result<()> {
        instructions::execute::handler(ctx)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel::handler(ctx)
    }

    pub fn force_expire(ctx: Context<ForceExpire>) -> Result<()> {
        instructions::force_expire::handler(ctx)
    }
}
