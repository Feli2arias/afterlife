import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./vigil.idl.json";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu"
);
export const CHECKIN_FEE = 5_000_000;

export interface BeneficiaryInput {
  wallet: PublicKey;
  shareBps: number;
}

export function getVaultConfigPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vigil"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getFeeVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault")],
    PROGRAM_ID
  );
}

export function getProgram(provider: AnchorProvider): Program {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

export async function registerVault(
  program: Program,
  owner: PublicKey,
  beneficiaries: BeneficiaryInput[],
  intervalDays: number,
  gracePeriodDays: number
) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  return program.methods
    .register(
      beneficiaries.map(b => ({ wallet: b.wallet, shareBps: b.shareBps })),
      intervalDays,
      gracePeriodDays
    )
    .accounts({
      vaultConfig: vaultConfigPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function checkin(program: Program, owner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  const [feeVault] = getFeeVaultPda();
  return program.methods
    .checkin()
    .accounts({
      vaultConfig: vaultConfigPda,
      owner,
      feeVault,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function cancelVault(program: Program, owner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  return program.methods
    .cancel()
    .accounts({
      vaultConfig: vaultConfigPda,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function forceExpire(program: Program, owner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  return program.methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .forceExpire()
    .accounts({ vaultConfig: vaultConfigPda, owner })
    .rpc();
}

export async function executeDistribution(program: Program, caller: PublicKey, vaultOwner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(vaultOwner);
  return program.methods
    .executeDistribution()
    .accounts({
      vaultConfig: vaultConfigPda,
      caller,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function fetchVaultConfig(program: Program, owner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (program.account as any)["vaultConfig"].fetch(vaultConfigPda);
  } catch {
    return null;
  }
}
