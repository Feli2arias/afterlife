import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  NATIVE_MINT,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { ExpiredVault } from "./monitor.js";

const PROGRAM_ID = new PublicKey(process.env.VIGIL_PROGRAM_ID!);
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export async function executeDistribution(
  connection: Connection,
  program: Program,
  vault: ExpiredVault,
  keeperKeypair: Keypair
): Promise<string> {
  const txSig = await (program.methods as Record<string, (...args: unknown[]) => { accounts: (a: Record<string, unknown>) => { signers: (s: unknown[]) => { rpc: () => Promise<string> } } }>)
    ["executeDistribution"]()
    .accounts({
      vaultConfig: vault.vaultConfigPda,
      caller: keeperKeypair.publicKey,
    })
    .signers([keeperKeypair])
    .rpc();

  console.log(`Distribution executed for ${vault.owner.toBase58()}: ${txSig}`);

  // Find all token accounts where keeper is the delegate
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(vault.owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  for (const { account } of tokenAccounts.value) {
    const info = account.data.parsed.info;
    if (info.delegate !== keeperKeypair.publicKey.toBase58()) continue;

    const mint = new PublicKey(info.mint);
    const delegatedAmount = BigInt(info.delegatedAmount?.amount ?? "0");
    if (delegatedAmount === 0n) continue;

    const srcAta = await getAssociatedTokenAddress(mint, vault.owner);

    // Ensure all beneficiary ATAs exist, then transfer proportional amounts
    const setupTx = new Transaction();
    const transferTx = new Transaction();

    for (const ben of vault.beneficiaries) {
      const benAmount = (delegatedAmount * BigInt(ben.shareBps)) / 10_000n;
      if (benAmount === 0n) continue;

      const dstAta = await getAssociatedTokenAddress(mint, ben.wallet, true);

      try {
        await getAccount(connection, dstAta);
      } catch {
        setupTx.add(
          createAssociatedTokenAccountInstruction(
            keeperKeypair.publicKey,
            dstAta,
            ben.wallet,
            mint
          )
        );
      }

      transferTx.add(
        createTransferInstruction(srcAta, dstAta, keeperKeypair.publicKey, benAmount)
      );
    }

    if (setupTx.instructions.length > 0) {
      await sendAndConfirmTransaction(connection, setupTx, [keeperKeypair]);
    }
    if (transferTx.instructions.length > 0) {
      await sendAndConfirmTransaction(connection, transferTx, [keeperKeypair]);
    }
  }

  return txSig;
}
