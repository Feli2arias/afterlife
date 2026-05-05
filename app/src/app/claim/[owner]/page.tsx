"use client";
import { use, useEffect, useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createCloseAccountInstruction, NATIVE_MINT, getAccount } from "@solana/spl-token";
import { getProgram, fetchVaultConfig } from "@/lib/vigil";

interface VaultData {
  owner: { toBase58: () => string };
  beneficiaries: Array<{ wallet: { toBase58: () => string }; shareBps: number }>;
  isActive: boolean;
  intervalDays: number;
  lastCheckin: { toNumber: () => number };
}

export default function ClaimPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner: ownerParam } = use(params);
  const { publicKey, signTransaction } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [solBalance, setSolBalance] = useState<number>(0);
  const [wsolBalance, setWsolBalance] = useState<bigint>(0n);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const ownerPk = new PublicKey(ownerParam);
        const bal = await connection.getBalance(ownerPk);
        setSolBalance(bal / LAMPORTS_PER_SOL);

        if (!wallet) return;
        const provider = new AnchorProvider(connection, wallet, {});
        const program = getProgram(provider);
        const data = await fetchVaultConfig(program, ownerPk);
        if (!data) { setError("No se encontró un Vigil para esta dirección."); return; }
        setVault(data as VaultData);
      } catch {
        setError("Dirección inválida.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ownerParam, wallet, connection]);

  // Check caller's wSOL balance when wallet connects
  useEffect(() => {
    if (!publicKey) return;
    getAssociatedTokenAddress(NATIVE_MINT, publicKey)
      .then(ata => getAccount(connection, ata))
      .then(account => setWsolBalance(account.amount))
      .catch(() => setWsolBalance(0n));
  }, [publicKey, connection, claimed]);

  async function claimWsol() {
    if (!publicKey || !signTransaction) return;
    setClaiming(true);
    try {
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, publicKey);
      const tx = new Transaction().add(
        createCloseAccountInstruction(wsolAta, publicKey, publicKey)
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const signed = await signTransaction(tx);
      await connection.sendRawTransaction(signed.serialize());
      setClaimed(true);
      setWsolBalance(0n);
    } catch (e) {
      console.error("Claim failed:", e);
    } finally {
      setClaiming(false);
    }
  }

  const myShare = vault?.beneficiaries.find(
    b => publicKey && b.wallet.toBase58() === publicKey.toBase58()
  );

  const isExpired = vault && !vault.isActive;
  const hasWsol = wsolBalance > 0n;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M4 16 L10 10 L16 20 L22 6 L28 16" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="28" cy="16" r="3" fill="#10b981"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Vigil — Reclamar activos</h1>
          <p className="text-gray-500 text-sm font-mono">
            {ownerParam.slice(0, 8)}...{ownerParam.slice(-6)}
          </p>
        </div>

        {loading && <p className="text-center text-gray-500 text-sm">Cargando...</p>}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && vault && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 border text-center ${
              isExpired ? "bg-emerald-500/10 border-emerald-500/30" : "bg-yellow-500/10 border-yellow-500/30"
            }`}>
              <div className={`text-sm font-medium ${isExpired ? "text-emerald-400" : "text-yellow-400"}`}>
                {isExpired ? "✓ Distribución activada" : "⏳ Vigil activo — aún no distribuible"}
              </div>
              {!isExpired && <p className="text-xs text-gray-500 mt-1">El titular todavía está activo.</p>}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Distribución</h3>
              {vault.beneficiaries.map((b, i) => {
                const isMe = publicKey && b.wallet.toBase58() === publicKey.toBase58();
                return (
                  <div key={i} className={`flex items-center justify-between text-sm p-2 rounded-lg ${isMe ? "bg-emerald-500/10 border border-emerald-500/30" : ""}`}>
                    <span className={`font-mono text-xs ${isMe ? "text-emerald-300" : "text-gray-400"}`}>
                      {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-4)}
                      {isMe && <span className="ml-2 text-emerald-500 not-italic font-sans">← vos</span>}
                    </span>
                    <div className="text-right">
                      <div className={`font-semibold ${isMe ? "text-emerald-400" : "text-gray-300"}`}>
                        {b.shareBps / 100}%
                      </div>
                      <div className="text-xs text-gray-500">
                        ≈ {((solBalance * b.shareBps) / 10_000).toFixed(4)} SOL
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!publicKey ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-400">Conectá tu wallet para ver si sos beneficiario</p>
                <WalletMultiButton />
              </div>
            ) : myShare ? (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-emerald-300 font-medium">Sos beneficiario</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Te corresponde el {myShare.shareBps / 100}% ≈ {((solBalance * myShare.shareBps) / 10_000).toFixed(4)} SOL
                  </p>
                </div>

                {isExpired && hasWsol && !claimed && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">wSOL disponible</span>
                      <span className="font-medium text-emerald-400">
                        {(Number(wsolBalance) / LAMPORTS_PER_SOL).toFixed(4)} SOL
                      </span>
                    </div>
                    <button
                      onClick={claimWsol}
                      disabled={claiming}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                    >
                      {claiming ? "Procesando..." : "Reclamar SOL"}
                    </button>
                    <p className="text-xs text-gray-500 text-center">Convierte tu wSOL a SOL nativo</p>
                  </div>
                )}

                {(claimed || (isExpired && !hasWsol && wsolBalance === 0n && myShare)) && (
                  <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 text-center text-sm text-emerald-300">
                    {claimed ? "✓ SOL reclamado exitosamente" : "Los activos fueron distribuidos a tu wallet."}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                Tu wallet no figura como beneficiaria de este Vigil.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
