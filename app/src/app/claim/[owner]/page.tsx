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

const G = {
  bg: "#030303",
  glassBorder: "rgba(255,255,255,0.08)",
  text: "#ffffff",
  textMuted: "#a1a1aa",
  textDim: "#52525b",
  emerald: "#10b981",
  emeraldDim: "rgba(16,185,129,0.1)",
  emeraldBorder: "rgba(16,185,129,0.2)",
  danger: "#ef4444",
};

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
      const tx = new Transaction().add(createCloseAccountInstruction(wsolAta, publicKey, publicKey));
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
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif", position: "relative" }}>

      {/* Noise */}
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Ambient */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 65%)", top: "-10%", left: "0", animation: "blob1 18s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}}`}</style>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 16px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo.png" alt="Vigil" style={{ width: 30, height: 30, objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }}>Vigil — Reclamar activos</h1>
          <p style={{ fontSize: 12, color: G.textDim, fontFamily: "monospace" }}>
            {ownerParam.slice(0, 8)}...{ownerParam.slice(-6)}
          </p>
        </div>

        {loading && <p style={{ textAlign: "center", color: G.textDim, fontSize: 14 }}>Cargando...</p>}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "16px", color: G.danger, fontSize: 14, textAlign: "center" }}>
            {error}
          </div>
        )}

        {!loading && !error && vault && (
          <>
            {/* Status */}
            <div className="liquid-glass" style={{ borderRadius: 20, padding: "16px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: isExpired ? G.emerald : "#f59e0b" }}>
                {isExpired ? "✓ Distribución activada" : "⏳ Vigil activo — aún no distribuible"}
              </div>
              {!isExpired && <p style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>El titular todavía está activo.</p>}
            </div>

            {/* Distribution */}
            <div className="liquid-glass" style={{ borderRadius: 20, padding: "20px" }}>
              <h3 style={{ fontSize: 12, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Distribución</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vault.beneficiaries.map((b, i) => {
                  const isMe = publicKey && b.wallet.toBase58() === publicKey.toBase58();
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: isMe ? G.emeraldDim : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? G.emeraldBorder : G.glassBorder}` }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: isMe ? "#86efac" : G.textMuted }}>
                        {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-4)}
                        {isMe && <span style={{ marginLeft: 8, fontSize: 11, color: G.emerald }}> ← vos</span>}
                      </span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? G.emerald : G.text }}>{b.shareBps / 100}%</div>
                        <div style={{ fontSize: 11, color: G.textDim }}>≈ {((solBalance * b.shareBps) / 10_000).toFixed(4)} SOL</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wallet / Claim */}
            {!publicKey ? (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <p style={{ fontSize: 14, color: G.textMuted }}>Conectá tu wallet para ver si sos beneficiario</p>
                <WalletMultiButton />
              </div>
            ) : myShare ? (
              <>
                <div style={{ background: G.emeraldDim, border: `1px solid ${G.emeraldBorder}`, borderRadius: 16, padding: "16px 20px", textAlign: "center" }}>
                  <p style={{ color: "#86efac", fontWeight: 600, fontSize: 14 }}>Sos beneficiario</p>
                  <p style={{ fontSize: 13, color: G.textMuted, marginTop: 4 }}>
                    Te corresponde el {myShare.shareBps / 100}% ≈ {((solBalance * myShare.shareBps) / 10_000).toFixed(4)} SOL
                  </p>
                </div>

                {isExpired && hasWsol && !claimed && (
                  <div className="liquid-glass" style={{ borderRadius: 20, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: G.textMuted }}>wSOL disponible</span>
                      <span style={{ fontWeight: 600, color: G.emerald }}>{(Number(wsolBalance) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                    </div>
                    <button
                      onClick={claimWsol}
                      disabled={claiming}
                      style={{ width: "100%", padding: "13px", borderRadius: 14, background: claiming ? "rgba(16,185,129,0.5)" : G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: claiming ? "default" : "pointer", transition: "all 0.2s", opacity: claiming ? 0.7 : 1 }}
                    >
                      {claiming ? "Procesando..." : "Reclamar SOL"}
                    </button>
                    <p style={{ fontSize: 12, color: G.textDim, textAlign: "center" }}>Convierte tu wSOL a SOL nativo</p>
                  </div>
                )}

                {(claimed || (isExpired && !hasWsol && myShare)) && (
                  <div style={{ background: G.emeraldDim, border: `1px solid ${G.emeraldBorder}`, borderRadius: 16, padding: "16px", textAlign: "center", fontSize: 14, color: "#86efac" }}>
                    {claimed ? "✓ SOL reclamado exitosamente" : "Los activos fueron distribuidos a tu wallet."}
                  </div>
                )}
              </>
            ) : (
              <p style={{ textAlign: "center", fontSize: 14, color: G.textDim }}>
                Tu wallet no figura como beneficiaria de este Vigil.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
