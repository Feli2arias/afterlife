use anchor_lang::prelude::*;

pub const MAX_BENEFICIARIES: usize = 5;
pub const CHECKIN_FEE_LAMPORTS: u64 = 5_000_000; // 0.005 SOL

// 8 + 32 + 32 + (4 + 5*(32+2)) + 2 + 1 + 8 + 1 + 1 + 32 + 8 + 5 = 304
pub const VAULT_CONFIG_SIZE: usize = 8
    + 32  // owner
    + 32  // backend_authority
    + 4 + (MAX_BENEFICIARIES * (32 + 2))  // beneficiaries vec
    + 2   // interval_days
    + 1   // grace_period_days
    + 8   // last_checkin
    + 1   // is_active
    + 1   // bump
    + 32  // executed_token_mint
    + 8   // executed_total
    + MAX_BENEFICIARIES; // claimed_flags [bool; 5]

#[account]
pub struct VaultConfig {
    pub owner: Pubkey,
    pub backend_authority: Pubkey,
    pub beneficiaries: Vec<Beneficiary>,
    pub interval_days: u16,
    pub grace_period_days: u8,
    pub last_checkin: i64,
    pub is_active: bool,
    pub bump: u8,
    /// Set at execution time — zero pubkey while active
    pub executed_token_mint: Pubkey,
    /// Total token amount moved to vault at execution
    pub executed_total: u64,
    /// One flag per beneficiary slot (indexed by position in beneficiaries vec)
    pub claimed_flags: [bool; 5],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Beneficiary {
    /// sha256 of the heir's email address
    pub email_hash: [u8; 32],
    /// Basis points (500 = 5%), all must sum to 10_000
    pub share_bps: u16,
}

impl VaultConfig {
    pub fn is_expired(&self, now: i64) -> bool {
        let interval_secs = self.interval_days as i64 * 86_400;
        let grace_secs = self.grace_period_days as i64 * 86_400;
        now > self.last_checkin + interval_secs + grace_secs
    }
}
