use anchor_lang::prelude::*;

#[error_code]
pub enum VigError {
    #[msg("Share basis points must sum to 10000")]
    InvalidShares,
    #[msg("Too many beneficiaries (max 5)")]
    TooManyBeneficiaries,
    #[msg("At least one beneficiary required")]
    NoBeneficiaries,
    #[msg("Interval must be 30, 60, or 90 days")]
    InvalidInterval,
    #[msg("Vault is not active")]
    VaultInactive,
    #[msg("Timer has not expired yet")]
    TimerNotExpired,
    #[msg("Only the owner can perform this action")]
    Unauthorized,
}
