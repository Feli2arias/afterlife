import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

export interface ExpiredVault {
  owner: PublicKey;
  vaultConfigPda: PublicKey;
  beneficiaries: Array<{ wallet: PublicKey; shareBps: number }>;
  gracePeriodDays: number;
  expiredSince: number;
}

export async function findExpiredVaults(program: Program): Promise<ExpiredVault[]> {
  const now = Math.floor(Date.now() / 1000);
  const allVaults = await (program.account as Record<string, { all: () => Promise<Array<{ publicKey: PublicKey; account: Record<string, unknown> }>> }>)["vaultConfig"].all();

  const expired: ExpiredVault[] = [];
  for (const { publicKey, account } of allVaults) {
    if (!account["isActive"]) continue;

    const intervalSecs = (account["intervalDays"] as number) * 86_400;
    const graceSecs = (account["gracePeriodDays"] as number) * 86_400;
    const lastCheckin = (account["lastCheckin"] as { toNumber: () => number }).toNumber();
    const deadline = lastCheckin + intervalSecs + graceSecs;

    if (now > deadline) {
      expired.push({
        owner: account["owner"] as PublicKey,
        vaultConfigPda: publicKey,
        beneficiaries: account["beneficiaries"] as Array<{ wallet: PublicKey; shareBps: number }>,
        gracePeriodDays: account["gracePeriodDays"] as number,
        expiredSince: now - deadline,
      });
    }
  }
  return expired;
}

export async function findExpiringVaults(program: Program): Promise<ExpiredVault[]> {
  const now = Math.floor(Date.now() / 1000);
  const warningWindowSecs = 7 * 86_400;
  const allVaults = await (program.account as Record<string, { all: () => Promise<Array<{ publicKey: PublicKey; account: Record<string, unknown> }>> }>)["vaultConfig"].all();

  return allVaults
    .filter(({ account }) => {
      if (!account["isActive"]) return false;
      const lastCheckin = (account["lastCheckin"] as { toNumber: () => number }).toNumber();
      const deadline = lastCheckin + (account["intervalDays"] as number) * 86_400;
      const timeLeft = deadline - now;
      return timeLeft > 0 && timeLeft <= warningWindowSecs;
    })
    .map(({ publicKey, account }) => ({
      owner: account["owner"] as PublicKey,
      vaultConfigPda: publicKey,
      beneficiaries: account["beneficiaries"] as Array<{ wallet: PublicKey; shareBps: number }>,
      gracePeriodDays: account["gracePeriodDays"] as number,
      expiredSince: 0,
    }));
}
