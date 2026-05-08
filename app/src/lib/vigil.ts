import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "./vigil.idl.json";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4pKCmz43y8apgNqoAZVhYba11r5MyW6fiDnH3WGb16Uu"
);
export const CHECKIN_FEE = 5_000_000;

export interface BeneficiaryInput {
  emailHash: number[];
  shareBps: number;
}

export function getVaultConfigPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vigil"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultAuthorityPda(vaultConfigPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_auth"), vaultConfigPda.toBuffer()],
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
  gracePeriodDays: number,
  backendAuthority: PublicKey
) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  return program.methods
    .register(
      beneficiaries.map(b => ({ emailHash: b.emailHash, shareBps: b.shareBps })),
      intervalDays,
      gracePeriodDays,
      backendAuthority
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
  const [vaultAuthorityPda] = getVaultAuthorityPda(vaultConfigPda);
  const ownerTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, vaultOwner);
  const vaultTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, vaultAuthorityPda, true);

  return program.methods
    .executeDistribution()
    .accounts({
      vaultConfig: vaultConfigPda,
      ownerTokenAccount,
      vaultAuthority: vaultAuthorityPda,
      vaultTokenAccount,
      tokenMint: NATIVE_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      caller,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function forceCloseVault(program: Program, owner: PublicKey) {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  return program.methods
    .forceClose()
    .accounts({
      vaultConfig: vaultConfigPda,
      owner,
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

export async function vaultConfigExists(program: Program, owner: PublicKey): Promise<boolean> {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  const info = await program.provider.connection.getAccountInfo(vaultConfigPda);
  return info !== null && info.lamports > 0;
}
