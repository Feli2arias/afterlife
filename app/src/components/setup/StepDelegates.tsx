"use client";
import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getUserTokenAccounts, approveDelegateForToken, wrapAndApproveSOL, TokenInfo } from "@/lib/delegate";
import { Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

interface Props {
  onNext: (delegated: string[]) => void;
  onBack: () => void;
}

export function StepDelegates({ onNext, onBack }: Props) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    getUserTokenAccounts(connection, publicKey)
      .then(setTokens)
      .finally(() => setLoading(false));
  }, [publicKey, connection]);

  async function approveToken(token: TokenInfo) {
    if (!publicKey || !signTransaction) return;
    const mintStr = token.mint.toBase58();
    setApproving(mintStr);
    setError(null);
    try {
      if (token.isNativeSol) {
        await wrapAndApproveSOL(
          connection,
          publicKey,
          token.balance,
          signTransaction as (tx: Transaction) => Promise<Transaction>
        );
      } else {
        await approveDelegateForToken(
          connection,
          publicKey,
          token.mint,
          token.balance,
          signTransaction as (tx: Transaction) => Promise<Transaction>
        );
      }
      setApproved(prev => new Set([...prev, mintStr]));
    } catch (e) {
      console.error("Approval failed:", e);
      setError(e instanceof Error ? e.message : "La transacción falló");
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Autorizá los activos</h2>
        <p className="text-gray-400 text-sm mt-2">Tus activos siguen en tu wallet. Afterlife solo tiene permiso de distribuirlos si el trigger se activa.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <p className="text-gray-500 text-sm text-center py-8">Cargando activos...</p>
        )}
        {tokens.map(token => {
          const mintStr = token.mint.toBase58();
          const isApproved = approved.has(mintStr);
          const isApproving = approving === mintStr;
          const displayAmount = token.isNativeSol
            ? (Number(token.balance) / LAMPORTS_PER_SOL).toFixed(4) + " SOL"
            : (Number(token.balance) / 10 ** token.decimals).toFixed(2) + " " + token.symbol;

          return (
            <div key={mintStr} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {token.symbol}
                  {token.isNativeSol && (
                    <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">se convierte a wSOL</span>
                  )}
                </div>
                {!token.isNativeSol && (
                  <div className="text-xs text-gray-500 font-mono">{mintStr.slice(0, 8)}...{mintStr.slice(-4)}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">{displayAmount}</div>
              </div>
              <button
                onClick={() => approveToken(token)}
                disabled={isApproved || !!isApproving}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isApproved
                    ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {isApproving ? "Aprobando..." : isApproved ? "✓ Listo" : "Incluir"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">
          Atrás
        </button>
        <button
          onClick={() => onNext([...approved])}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors"
        >
          Continuar {approved.size > 0 ? `(${approved.size})` : ""}
        </button>
      </div>
    </div>
  );
}
