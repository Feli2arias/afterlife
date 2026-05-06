"use client";
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  emerald: "rgba(255,255,255,0.9)",
  emeraldDim: "rgba(255,255,255,0.06)",
  emeraldBorder: "rgba(255,255,255,0.12)",
  danger: "#ef4444",
};

const DEMO_VAULT: VaultData = {
  owner: { toBase58: () => "Demo1111111111111111111111111111111111111111" },
  beneficiaries: [
    { wallet: { toBase58: () => "Bene1abc123def456ghi789jkl012mno345pqr678stu" }, shareBps: 5000 },
    { wallet: { toBase58: () => "Bene2xyz987wvu654tsr321qpo098nml765kji432hg" }, shareBps: 3000 },
    { wallet: { toBase58: () => "Bene3zzz111aaa222bbb333ccc444ddd555eee666ff" }, shareBps: 2000 },
  ],
  isActive: false,
  intervalDays: 60,
  lastCheckin: { toNumber: () => Math.floor(Date.now() / 1000) - 70 * 86400 },
};

export default function ClaimPage({ params }: { params: Promise<{ owner: string }> }) {
  return <Suspense><ClaimContent params={params} /></Suspense>;
}

function ClaimContent({ params }: { params: Promise<{ owner: string }> }) {
  const { owner: ownerParam } = use(params);
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1" || ownerParam === "DEMO";
  const { publicKey, signTransaction } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [vault, setVault] = useState<VaultData | null>(isDemo ? DEMO_VAULT : null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState("");
  const [solBalance, setSolBalance] = useState<number>(isDemo ? 4.237 : 0);
  const [wsolBalance, setWsolBalance] = useState<bigint>(isDemo ? BigInt(2_100_000_000) : 0n);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    async function load() {
      try {
        const ownerPk = new PublicKey(ownerParam);
        const bal = await connection.getBalance(ownerPk);
        setSolBalance(bal / LAMPORTS_PER_SOL);
        if (!wallet) return;
        const provider = new AnchorProvider(connection, wallet, {});
        const program = getProgram(provider);
        const data = await fetchVaultConfig(program, ownerPk);
        if (!data) { setError("No Afterlife vault found for this address."); return; }
        setVault(data as VaultData);
      } catch {
        setError("Invalid address.");
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

      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 65%)", top: "-10%", left: "0", animation: "blob1 18s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}}`}</style>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 16px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo.png" alt="Afterlife" style={{ width: 30, height: 30, objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 6 }}>Afterlife — Claim Assets</h1>
          <p style={{ fontSize: 12, color: G.textDim, fontFamily: "monospace" }}>
            {ownerParam.slice(0, 8)}...{ownerParam.slice(-6)}
          </p>
        </div>

        {loading && <p style={{ textAlign: "center", color: G.textDim, fontSize: 14 }}>Loading...</p>}

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
                {isExpired ? "✓ Distribution activated" : "⏳ Vault active — not yet distributable"}
              </div>
              {!isExpired && <p style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>The owner is still active.</p>}
            </div>

            {/* Distribution */}
            <div className="liquid-glass" style={{ borderRadius: 20, padding: "20px" }}>
              <h3 style={{ fontSize: 12, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Distribution</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vault.beneficiaries.map((b, i) => {
                  const isMe = publicKey && b.wallet.toBase58() === publicKey.toBase58();
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, background: isMe ? G.emeraldDim : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? G.emeraldBorder : G.glassBorder}` }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: isMe ? "white" : G.textMuted }}>
                        {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-4)}
                        {isMe && <span style={{ marginLeft: 8, fontSize: 11, color: G.emerald }}> ← you</span>}
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
                <p style={{ fontSize: 14, color: G.textMuted }}>Connect your wallet to check if you're a beneficiary</p>
                <WalletMultiButton />
              </div>
            ) : myShare ? (
              <>
                <div style={{ background: G.emeraldDim, border: `1px solid ${G.emeraldBorder}`, borderRadius: 16, padding: "16px 20px", textAlign: "center" }}>
                  <p style={{ color: "white", fontWeight: 600, fontSize: 14 }}>You are a beneficiary</p>
                  <p style={{ fontSize: 13, color: G.textMuted, marginTop: 4 }}>
                    You're entitled to {myShare.shareBps / 100}% ≈ {((solBalance * myShare.shareBps) / 10_000).toFixed(4)} SOL
                  </p>
                </div>

                {isExpired && hasWsol && !claimed && (
                  <div className="liquid-glass" style={{ borderRadius: 20, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: G.textMuted }}>Available wSOL</span>
                      <span style={{ fontWeight: 600, color: G.emerald }}>{(Number(wsolBalance) / LAMPORTS_PER_SOL).toFixed(4)} SOL</span>
                    </div>
                    <button
                      onClick={claimWsol}
                      disabled={claiming}
                      style={{ width: "100%", padding: "13px", borderRadius: 14, background: claiming ? "rgba(255,255,255,0.4)" : "white", color: "black", fontSize: 14, fontWeight: 700, border: "none", cursor: claiming ? "default" : "pointer", transition: "all 0.2s", opacity: claiming ? 0.7 : 1 }}
                    >
                      {claiming ? "Processing..." : "Claim SOL"}
                    </button>
                    <p style={{ fontSize: 12, color: G.textDim, textAlign: "center" }}>Converts your wSOL to native SOL</p>
                  </div>
                )}

                {(claimed || (isExpired && !hasWsol && myShare)) && (
                  <div style={{ background: G.emeraldDim, border: `1px solid ${G.emeraldBorder}`, borderRadius: 16, padding: "16px", textAlign: "center", fontSize: 14, color: "white" }}>
                    {claimed ? "✓ SOL successfully claimed" : "Assets have been distributed to your wallet."}
                  </div>
                )}
              </>
            ) : (
              <p style={{ textAlign: "center", fontSize: 14, color: G.textDim }}>
                Your wallet is not listed as a beneficiary of this Afterlife.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
