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
    #[msg("Will is not active")]
    VaultInactive,
    #[msg("Timer has not expired yet")]
    TimerNotExpired,
    #[msg("Only the owner can perform this action")]
    Unauthorized,
    #[msg("Will has not been executed yet")]
    NotExecuted,
    #[msg("This allocation has already been claimed")]
    AlreadyClaimed,
    #[msg("Backend authority mismatch")]
    InvalidAuthority,
    #[msg("No beneficiary found with that email hash")]
    BeneficiaryNotFound,
    #[msg("Token balance is zero, nothing to distribute")]
    ZeroBalance,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Token mint does not match the executed distribution")]
    InvalidTokenMint,
}
