use anchor_lang::prelude::*;

pub const MAX_BENEFICIARIES: usize = 5;
pub const CHECKIN_FEE_LAMPORTS: u64 = 5_000_000; // 0.005 SOL
pub const VAULT_CONFIG_SIZE: usize = 8   // discriminator
    + 32                                  // owner: Pubkey
    + 4 + (MAX_BENEFICIARIES * (32 + 2)) // beneficiaries: Vec (4 len + each entry)
    + 2                                   // interval_days: u16
    + 1                                   // grace_period_days: u8
    + 8                                   // last_checkin: i64
    + 8                                   // _reserved: u64 (unused, kept for account layout compat)
    + 1                                   // is_active: bool
    + 1;                                  // bump: u8

#[account]
pub struct VaultConfig {
    pub owner: Pubkey,
    pub beneficiaries: Vec<Beneficiary>,
    pub interval_days: u16,
    pub grace_period_days: u8,
    pub last_checkin: i64,
    pub _reserved: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Beneficiary {
    pub wallet: Pubkey,
    pub share_bps: u16,
}

impl VaultConfig {
    pub fn is_expired(&self, now: i64) -> bool {
        let interval_secs = self.interval_days as i64 * 86_400;
        let grace_secs = self.grace_period_days as i64 * 86_400;
        now > self.last_checkin + interval_secs + grace_secs
    }
}
