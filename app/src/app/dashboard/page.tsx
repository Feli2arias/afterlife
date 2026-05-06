"use client";
import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getProgram, fetchVaultConfig, forceExpire, executeDistribution,
  cancelVault, registerVault, checkin, BeneficiaryInput,
} from "@/lib/vigil";
import { useRouter, useSearchParams } from "next/navigation";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";
const MONO = "'Courier New', Courier, monospace";

const DEMO_VAULT = {
  owner: { toBase58: () => "Demo1111111111111111111111111111111111111111" },
  beneficiaries: [
    { wallet: { toBase58: () => "Bene1abc123def456ghi789jkl012mno345pqr678stu" }, shareBps: 5000 },
    { wallet: { toBase58: () => "Bene2xyz987wvu654tsr321qpo098nml765kji432hg" }, shareBps: 3000 },
    { wallet: { toBase58: () => "Bene3zzz111aaa222bbb333ccc444ddd555eee666ff" }, shareBps: 2000 },
  ],
  isActive: true,
  intervalDays: 60,
  gracePeriodDays: 7,
  lastCheckin: { toNumber: () => Math.floor(Date.now() / 1000) - 18 * 86400 },
};

type VaultData = {
  owner: { toBase58: () => string };
  beneficiaries: Array<{ wallet: { toBase58: () => string }; shareBps: number }>;
  isActive: boolean;
  intervalDays: number;
  gracePeriodDays: number;
  lastCheckin: { toNumber: () => number };
};

function timeRemaining(lastCheckin: number, intervalDays: number, gracePeriodDays: number) {
  const deadline = lastCheckin + (intervalDays + gracePeriodDays) * 86_400;
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;
  if (remaining <= 0) return { expired: true, days: 0, hours: 0, mins: 0, secs: 0, pct: 0, remaining: 0 };
  const total = (intervalDays + gracePeriodDays) * 86_400;
  return {
    expired: false,
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3600),
    mins: Math.floor((remaining % 3600) / 60),
    secs: remaining % 60,
    pct: Math.round((remaining / total) * 100),
    remaining,
  };
}

// ─── Hold-to-confirm button ────────────────────────────────────────────────

function HoldToConfirm({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 2000;

  const tick = useCallback((ts: number) => {
    if (!startRef.current) startRef.current = ts;
    const pct = Math.min(((ts - startRef.current) / DURATION) * 100, 100);
    setProgress(pct);
    if (pct < 100) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setHolding(false);
      setDone(true);
      setProgress(0);
      startRef.current = null;
      onConfirm();
      setTimeout(() => setDone(false), 1500);
    }
  }, [onConfirm]);

  const begin = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (loading || done) return;
    setHolding(true);
    startRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [loading, done, tick]);

  const end = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (holding) { setHolding(false); setProgress(0); startRef.current = null; }
  }, [holding]);

  const filled = Math.round(progress / 100 * 28);
  const barStr = "█".repeat(filled) + "░".repeat(28 - filled);

  return (
    <button
      onMouseDown={begin} onMouseUp={end} onMouseLeave={end}
      onTouchStart={begin} onTouchEnd={end}
      disabled={loading}
      style={{
        position: "relative", overflow: "hidden",
        width: "100%", padding: "32px 24px",
        background: done
          ? "rgba(255,255,255,0.04)"
          : holding
          ? "rgba(220,38,38,0.06)"
          : "linear-gradient(145deg, rgba(200,200,200,0.05) 0%, rgba(200,200,200,0.01) 100%)",
        border: `1px solid ${done ? "rgba(255,255,255,0.2)" : holding ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderTopColor: holding ? "rgba(220,38,38,0.7)" : done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
        borderRadius: 20,
        backdropFilter: "blur(50px) saturate(200%)",
        WebkitBackdropFilter: "blur(50px) saturate(200%)",
        boxShadow: holding
          ? "0 0 0 1px rgba(220,38,38,0.2), 0 30px 60px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)"
          : "0 30px 60px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.4)",
        cursor: loading ? "default" : "pointer",
        userSelect: "none", WebkitUserSelect: "none",
        outline: "none",
        transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}
    >
      {/* Red fill sweep */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${progress}%`,
        background: "linear-gradient(90deg, rgba(220,38,38,0.15), rgba(220,38,38,0.04))",
        borderRadius: "20px 0 0 20px",
        pointerEvents: "none",
        transition: "none",
      }} />
      {/* Top edge glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, height: 1,
        width: `${progress}%`,
        background: "linear-gradient(90deg, #dc2626, rgba(220,38,38,0.3))",
        borderRadius: 20,
        boxShadow: "0 0 12px rgba(220,38,38,0.6)",
        opacity: holding ? 1 : 0,
        transition: "none",
      }} />
      {/* Label */}
      <div style={{
        position: "relative",
        fontFamily: SF, fontSize: 12, fontWeight: 600,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: done ? "rgba(255,255,255,0.8)" : holding ? "#ef4444" : "rgba(255,255,255,0.4)",
        transition: "color 0.3s",
      }}>
        {loading ? "Processing..." : done ? "✓ Signal received" : holding ? "Keep holding..." : "Hold to confirm"}
      </div>
      {/* Unicode bar */}
      <div style={{
        position: "relative",
        fontFamily: MONO, fontSize: 12, letterSpacing: "0.05em",
        color: holding ? "rgba(220,38,38,0.7)" : "rgba(255,255,255,0.1)",
        transition: "color 0.3s",
      }}>
        {barStr}
      </div>
    </button>
  );
}

// ─── Timer ─────────────────────────────────────────────────────────────────

function VaultTimer({ days, hours, mins, secs, pct, expired }: {
  days: number; hours: number; mins: number; secs: number; pct: number; expired: boolean;
}) {
  const filled = Math.round(pct / 100 * 36);
  const bar = "█".repeat(filled) + "░".repeat(36 - filled);

  return (
    <div className="liquid-glass" style={{ borderRadius: 24, padding: "36px 32px", width: "100%", textAlign: "center" }}>
      {/* Status label */}
      <div style={{
        fontFamily: SF, fontSize: 11, fontWeight: 500,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: expired ? "#ef4444" : "rgba(255,255,255,0.3)",
        marginBottom: 28,
      }}>
        {expired ? "Time expired" : "Vault active · Solana Devnet"}
      </div>

      {!expired ? (
        <>
          {/* Numbers */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            {[
              { v: String(days).padStart(2, "0"), l: "days" },
              { v: String(hours).padStart(2, "0"), l: "hrs" },
              { v: String(mins).padStart(2, "0"), l: "min" },
              { v: String(secs).padStart(2, "0"), l: "sec" },
            ].map(({ v, l }, i, arr) => (
              <div key={l} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: l === "días" ? "clamp(48px, 10vw, 88px)" : "clamp(32px, 7vw, 60px)",
                    fontWeight: 700, lineHeight: 1,
                    letterSpacing: "-0.04em",
                    color: "white",
                    fontVariantNumeric: "tabular-nums",
                  }}>{v}</div>
                  <div style={{ fontFamily: SF, fontSize: 9, letterSpacing: "0.2em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>{l}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ fontFamily: MONO, fontSize: "clamp(24px,5vw,44px)", color: "rgba(255,255,255,0.15)", lineHeight: 1, paddingBottom: 22 }}>:</div>
                )}
              </div>
            ))}
          </div>

          {/* Unicode bar */}
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "rgba(255,255,255,0.12)", marginBottom: 8 }}>{bar}</div>
          <div style={{ fontFamily: SF, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{pct}% remaining</div>
        </>
      ) : (
        <div style={{ fontFamily: MONO, fontSize: "clamp(40px, 8vw, 72px)", fontWeight: 700, color: "#dc2626", letterSpacing: "-0.04em" }}>
          00:00:00
        </div>
      )}
    </div>
  );
}

// ─── Info panel (bottom sheet) ─────────────────────────────────────────────

function InfoPanel({
  open, onClose, vault, solBal, publicKey, isDemo,
  onEditInterval, onEditBens, onSimulate, simulating, simMsg, claimUrl,
}: {
  open: boolean; onClose: () => void;
  vault: VaultData; solBal: number; publicKey: string; isDemo: boolean;
  onEditInterval: () => void; onEditBens: () => void;
  onSimulate: () => void; simulating: boolean; simMsg: string; claimUrl: string;
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.3s",
      }} />

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "linear-gradient(135deg, rgba(20,20,20,0.92) 0%, rgba(10,10,10,0.85) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTopColor: "rgba(255,255,255,0.12)",
        borderBottom: "none",
        borderRadius: "24px 24px 0 0",
        padding: "0 0 40px",
        maxHeight: "80vh", overflowY: "auto",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.08)",
        fontFamily: SF,
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "14px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "rgba(10,10,10,0.8)", backdropFilter: "blur(20px)", zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Details</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "5px 14px", fontFamily: SF }}>Close</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Beneficiaries */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Beneficiaries</div>
              <button onClick={onEditBens} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 11, padding: "4px 12px", fontFamily: SF }}>Edit</button>
            </div>
            {vault.beneficiaries.map((b, i) => {
              const pct = b.shareBps / 100;
              const sol = (solBal * b.shareBps / 10_000).toFixed(3);
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontFamily: MONO, color: "rgba(255,255,255,0.4)" }}>{b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-6)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{pct}% · ~{sol} SOL</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "rgba(255,255,255,0.35)", borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settings */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Settings</div>
              <button onClick={onEditInterval} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 11, padding: "4px 12px", fontFamily: SF }}>Edit</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { l: "Frequency", v: `Every ${vault.intervalDays} days` },
                { l: "Grace period", v: vault.gracePeriodDays === 0 ? "None" : `+${vault.gracePeriodDays} days` },
              ].map(({ l, v }) => (
                <div key={l} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Claim link */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Link for beneficiaries</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 14px", fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {claimUrl}
              </div>
              <button onClick={() => navigator.clipboard.writeText(claimUrl)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "10px 16px", fontFamily: SF, flexShrink: 0 }}>Copy</button>
            </div>
          </div>

          {/* Demo zone */}
          {isDemo && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 16, padding: "18px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(220,38,38,0.6)", marginBottom: 12 }}>Demo — Simulate expiry</div>
              <button onClick={onSimulate} disabled={simulating} style={{ background: simulating ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 12, color: "#ef4444", cursor: simulating ? "default" : "pointer", fontSize: 13, fontWeight: 600, padding: "11px 18px", fontFamily: SF, opacity: simulating ? 0.6 : 1, transition: "all 0.2s" }}>
                {simulating ? "Simulating..." : "☠ Execute distribution"}
              </button>
              {simMsg && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10 }}>{simMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
      <div className="liquid-glass-dark" style={{ width: "100%", maxWidth: 480, borderRadius: 24, padding: "28px 24px", animation: "modalIn 0.2s ease", fontFamily: SF }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, padding: "4px 12px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditIntervalModal({ current, grace, onSave, onClose, loading }: { current: number; grace: number; onSave: (d: number, g: number) => void; onClose: () => void; loading: boolean }) {
  const [days, setDays] = useState(current);
  const [gr, setGr] = useState(grace);
  return (
    <Modal title="Edit check-in interval" onClose={onClose}>
      <div style={{ marginBottom: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Check-in interval</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{ padding: "14px", borderRadius: 14, border: `1px solid ${days === d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: days === d ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)", color: days === d ? "white" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: SF, transition: "all 0.15s" }}>{d} days</button>
        ))}
      </div>
      <div style={{ marginBottom: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Grace period</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[0, 3, 7, 14].map(d => (
          <button key={d} onClick={() => setGr(d)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: `1px solid ${gr === d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: gr === d ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)", color: gr === d ? "white" : "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: SF, transition: "all 0.15s" }}>
            {d === 0 ? "No grace" : `+${d}d`}
          </button>
        ))}
      </div>
      <button onClick={() => onSave(days, gr)} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 14, background: loading ? "rgba(255,255,255,0.3)" : "white", color: "black", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontFamily: SF }}>
        {loading ? "Saving..." : "Save"}
      </button>
    </Modal>
  );
}

function EditBeneficiariesModal({ initialRows, onSave, onClose, loading }: { initialRows: Array<{ wallet: string; share: number }>; onSave: (rows: BeneficiaryInput[]) => void; onClose: () => void; loading: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const total = rows.reduce((s, r) => s + Number(r.share || 0), 0);

  function validate(): BeneficiaryInput[] | null {
    if (Math.abs(total - 100) > 0.01) { setError("Total must be 100%"); return null; }
    const result: BeneficiaryInput[] = [];
    for (const row of rows) {
      try { result.push({ wallet: new PublicKey(row.wallet.trim()), shareBps: Math.round(row.share * 100) }); }
      catch { setError(`Invalid wallet: ${row.wallet.slice(0, 16)}`); return null; }
    }
    return result;
  }

  return (
    <Modal title="Edit beneficiaries" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={row.wallet} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, wallet: e.target.value } : r))} placeholder="Wallet address" style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "white", fontFamily: MONO, outline: "none" }} />
            <input type="number" min={1} max={100} value={row.share} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))} style={{ width: 56, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 6px", fontSize: 13, color: "white", textAlign: "center", fontFamily: SF, outline: "none" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>%</span>
            {rows.length > 1 && <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => rows.length < 5 && setRows(prev => [...prev, { wallet: "", share: 0 }])} disabled={rows.length >= 5} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontFamily: SF, padding: 0 }}>+ Add</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: Math.abs(total - 100) < 0.01 ? "rgba(255,255,255,0.6)" : "#ef4444" }}>{total}%</span>
      </div>
      {error && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</p>}
      <button onClick={() => { const v = validate(); if (v) onSave(v); }} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 14, background: loading ? "rgba(255,255,255,0.3)" : "white", color: "black", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontFamily: SF }}>
        {loading ? "Saving..." : "Save"}
      </button>
    </Modal>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";

  const [vault, setVault] = useState<VaultData | null>(isDemo ? DEMO_VAULT as unknown as VaultData : null);
  const [loading, setLoading] = useState(!isDemo);
  const [solBal, setSolBal] = useState(isDemo ? 4.237 : 0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editInterval, setEditInterval] = useState(false);
  const [editBens, setEditBens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState("");
  const [, setTick] = useState(0);

  // Live timer — update every second
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const loadVault = useCallback(async () => {
    if (isDemo) return;
    if (!publicKey || !wallet) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    const data = await fetchVaultConfig(program, publicKey);
    if (!data) { router.push("/setup"); return; }
    setVault(data as unknown as VaultData);
    const bal = await connection.getBalance(publicKey);
    setSolBal(bal / LAMPORTS_PER_SOL);
    setLoading(false);
  }, [publicKey, wallet, connection, router, isDemo]);

  useEffect(() => { loadVault(); }, [loadVault]);

  async function handleCheckin() {
    if (isDemo || !publicKey || !wallet) return;
    setCheckingIn(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await checkin(program, publicKey);
      await loadVault();
    } finally { setCheckingIn(false); }
  }

  async function saveInterval(days: number, grace: number) {
    if (!publicKey || !wallet || !vault) return;
    setSaving(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await cancelVault(program, publicKey);
      const bens: BeneficiaryInput[] = vault.beneficiaries.map(b => ({ wallet: b.wallet as unknown as PublicKey, shareBps: b.shareBps }));
      await registerVault(program, publicKey, bens, days, grace);
      setEditInterval(false);
      await loadVault();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function saveBeneficiaries(newBens: BeneficiaryInput[]) {
    if (!publicKey || !wallet || !vault) return;
    setSaving(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await cancelVault(program, publicKey);
      await registerVault(program, publicKey, newBens, vault.intervalDays, vault.gracePeriodDays);
      setEditBens(false);
      await loadVault();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleSimulate() {
    if (!publicKey || !wallet) return;
    setSimulating(true); setSimMsg("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      setSimMsg("Backdating timer...");
      await forceExpire(program, publicKey);
      setSimMsg("Executing distribution...");
      await executeDistribution(program, publicKey, publicKey);
      setSimMsg("Done");
      await loadVault();
    } catch (e) { setSimMsg("Error: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSimulating(false); }
  }

  if (!publicKey && !isDemo) {
    return (
      <div style={{ minHeight: "100vh", background: "#030303", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <img src="/logo.png" alt="Vigil" style={{ width: 40, height: 40, opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>Connect your wallet to continue</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#030303", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>Loading...</p>
      </div>
    );
  }

  if (!vault) return null;

  const lastCheckin = vault.lastCheckin.toNumber();
  const timer = timeRemaining(lastCheckin, vault.intervalDays, vault.gracePeriodDays);
  const ownerAddr = isDemo ? "Demo1111111111111111111111111111111111111111" : publicKey?.toBase58() ?? "";
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim/${ownerAddr}` : "";
  const initialBenRows = vault.beneficiaries.map(b => ({ wallet: b.wallet.toBase58(), share: b.shareBps / 100 }));

  return (
    <div style={{
      minHeight: "100vh", background: "#030303", color: "white",
      fontFamily: SF,
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Ambient blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.015) 0%, transparent 65%)", top: "-15%", left: "-10%", animation: "blob1 20s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 65%)", bottom: "5%", right: "-5%", animation: "blob2 25s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}@keyframes blob2{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}}`}</style>

      {/* Top bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(3,3,3,0.7)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Vigil" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.6 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>Vigil</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isDemo && (
            <span style={{ fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.25)" }}>
              {ownerAddr.slice(0, 6)}...{ownerAddr.slice(-4)}
            </span>
          )}
          <button
            onClick={() => setInfoOpen(true)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "6px 14px", fontFamily: SF, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
          >Details</button>
          {!isDemo && <WalletMultiButton style={{ fontSize: 12, borderRadius: 20, height: 34 }} />}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "100px 24px 120px",
        maxWidth: 520, margin: "0 auto", width: "100%",
        gap: 16,
      }}>
        {/* Timer card */}
        <VaultTimer
          days={timer.days} hours={timer.hours} mins={timer.mins} secs={timer.secs}
          pct={timer.pct} expired={timer.expired}
        />

        {/* Hold button */}
        {vault.isActive ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <HoldToConfirm onConfirm={handleCheckin} loading={checkingIn} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              Last check-in: {new Date(lastCheckin * 1000).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        ) : (
          <div className="liquid-glass" style={{ width: "100%", borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", marginBottom: 10 }}>Distribution executed</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>Assets have been distributed to beneficiaries.</div>
          </div>
        )}
      </div>

      <InfoPanel
        open={infoOpen} onClose={() => setInfoOpen(false)}
        vault={vault} solBal={solBal} publicKey={ownerAddr} isDemo={isDemo}
        onEditInterval={() => { setInfoOpen(false); setTimeout(() => setEditInterval(true), 350); }}
        onEditBens={() => { setInfoOpen(false); setTimeout(() => setEditBens(true), 350); }}
        onSimulate={handleSimulate} simulating={simulating} simMsg={simMsg}
        claimUrl={claimUrl}
      />

      {editInterval && vault && (
        <EditIntervalModal current={vault.intervalDays} grace={vault.gracePeriodDays} onSave={saveInterval} onClose={() => setEditInterval(false)} loading={saving} />
      )}
      {editBens && vault && (
        <EditBeneficiariesModal initialRows={initialBenRows} onSave={saveBeneficiaries} onClose={() => setEditBens(false)} loading={saving} />
      )}
    </div>
  );
}
