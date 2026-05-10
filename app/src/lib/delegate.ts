import {
  Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createApproveInstruction,
  createRevokeInstruction,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
  getAccount,
} from "@solana/spl-token";
import { getVaultConfigPda } from "./afterlife";

export const WSOL_MINT = NATIVE_MINT;

export interface TokenInfo {
  mint: PublicKey;
  balance: bigint;
  decimals: number;
  symbol: string;
  isNativeSol?: boolean;
}

// Wrap SOL → wSOL + approve vault_config PDA as delegate in one tx
export async function wrapAndApproveSOL(
  connection: Connection,
  owner: PublicKey,
  lamports: bigint,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  const wsolAta = await getAssociatedTokenAddress(WSOL_MINT, owner);

  const tx = new Transaction();

  try {
    await getAccount(connection, wsolAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(owner, wsolAta, owner, WSOL_MINT)
    );
  }

  // Check existing wSOL balance so approval covers the full post-wrap total
  let existingBalance = 0n;
  try {
    const acct = await getAccount(connection, wsolAta);
    existingBalance = acct.amount;
  } catch { /* account doesn't exist yet */ }

  tx.add(
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: wsolAta, lamports })
  );
  tx.add(createSyncNativeInstruction(wsolAta));
  tx.add(createApproveInstruction(wsolAta, vaultConfigPda, owner, existingBalance + lamports));

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signed = await signTransaction(tx);
  return connection.sendRawTransaction(signed.serialize());
}

export async function approveDelegateForToken(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  amount: bigint,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const [vaultConfigPda] = getVaultConfigPda(owner);
  const tokenAccount = await getAssociatedTokenAddress(mint, owner);

  const tx = new Transaction().add(
    createApproveInstruction(tokenAccount, vaultConfigPda, owner, amount)
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signed = await signTransaction(tx);
  return connection.sendRawTransaction(signed.serialize());
}

export async function revokeDelegate(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const tokenAccount = await getAssociatedTokenAddress(mint, owner);
  const tx = new Transaction().add(createRevokeInstruction(tokenAccount, owner));
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  const signed = await signTransaction(tx);
  return connection.sendRawTransaction(signed.serialize());
}

export async function getUserTokenAccounts(
  connection: Connection,
  owner: PublicKey
): Promise<TokenInfo[]> {
  const [splAccounts, solBalance] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    }),
    connection.getBalance(owner),
  ]);

  const tokens: TokenInfo[] = [];

  const wsolAccount = splAccounts.value.find(
    a => a.account.data.parsed.info.mint === WSOL_MINT.toBase58()
  );
  const wsolBalance = wsolAccount
    ? BigInt(wsolAccount.account.data.parsed.info.tokenAmount.amount)
    : 0n;

  if (wsolBalance > 0n) {
    tokens.push({
      mint: WSOL_MINT,
      balance: wsolBalance,
      decimals: 9,
      symbol: "SOL",
      isNativeSol: false,
    });
  } else if (solBalance > 50_000_000) {
    const protectable = BigInt(solBalance - 50_000_000);
    tokens.push({
      mint: WSOL_MINT,
      balance: protectable,
      decimals: 9,
      symbol: "SOL",
      isNativeSol: true,
    });
  }

  const splTokens = splAccounts.value
    .filter(a => {
      const info = a.account.data.parsed.info;
      return Number(info.tokenAmount.amount) > 0 &&
        info.mint !== WSOL_MINT.toBase58();
    })
    .map(a => ({
      mint: new PublicKey(a.account.data.parsed.info.mint),
      balance: BigInt(a.account.data.parsed.info.tokenAmount.amount),
      decimals: a.account.data.parsed.info.tokenAmount.decimals,
      symbol: "TOKEN",
    }));

  return [...tokens, ...splTokens];
}
