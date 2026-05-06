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
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

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
    pct: (remaining / total) * 100,
    remaining,
  };
}

// ─── Progress Ring ─────────────────────────────────────────────────────────

function ProgressRing({ days, hours, mins, secs, pct, expired }: {
  days: number; hours: number; mins: number; secs: number; pct: number; expired: boolean;
}) {
  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUTER = 122;
  const R_INNER = 108;
  const CIRC_OUTER = 2 * Math.PI * R_OUTER;
  const CIRC_INNER = 2 * Math.PI * R_INNER;
  const outerOffset = CIRC_OUTER * (1 - pct / 100);
  const secsOffset = CIRC_INNER * (1 - (secs / 60));

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto", flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        {/* Outer track */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
        {/* Outer fill — time remaining */}
        <circle
          cx={CX} cy={CY} r={R_OUTER} fill="none"
          stroke={expired ? "rgba(220,38,38,0.7)" : "rgba(255,255,255,0.85)"}
          strokeWidth={5} strokeLinecap="round"
          strokeDasharray={CIRC_OUTER}
          strokeDashoffset={expired ? 0 : outerOffset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
        {/* Inner track */}
        <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={3} />
        {/* Inner fill — seconds sweep */}
        {!expired && (
          <circle
            cx={CX} cy={CY} r={R_INNER} fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={3} strokeLinecap="round"
            strokeDasharray={CIRC_INNER}
            strokeDashoffset={secsOffset}
            style={{ transition: "stroke-dashoffset 0.9s linear" }}
          />
        )}
      </svg>

      {/* Center */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 0,
      }}>
        {expired ? (
          <>
            <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(220,38,38,0.8)", marginBottom: 8 }}>Expired</div>
            <div style={{ fontFamily: MONO, fontSize: 42, fontWeight: 700, color: "#dc2626", lineHeight: 1, letterSpacing: "-0.04em" }}>00:00</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: MONO, fontSize: 68, fontWeight: 700, color: "white", lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
              {String(days).padStart(2, "0")}
            </div>
            <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 6, marginBottom: 10 }}>
              days
            </div>
            <div style={{ fontFamily: MONO, fontSize: 17, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>
              {String(hours).padStart(2,"0")}:{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hold button ───────────────────────────────────────────────────────────

function HoldButton({ onConfirm, loading }: { onConfirm: () => void; loading: boolean }) {
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
      setHolding(false); setDone(true); setProgress(0); startRef.current = null;
      onConfirm();
      setTimeout(() => setDone(false), 2000);
    }
  }, [onConfirm]);

  const begin = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (loading || done) return;
    setHolding(true); startRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [loading, done, tick]);

  const end = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (holding) { setHolding(false); setProgress(0); startRef.current = null; }
  }, [holding]);

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Button */}
      <button
        onMouseDown={begin} onMouseUp={end} onMouseLeave={end}
        onTouchStart={begin} onTouchEnd={end}
        disabled={loading}
        style={{
          position: "relative", overflow: "hidden",
          width: "100%", height: 60,
          background: done
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${holding ? "rgba(220,38,38,0.4)" : done ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 16,
          cursor: loading ? "default" : "pointer",
          userSelect: "none", WebkitUserSelect: "none",
          outline: "none",
          transition: "border-color 0.3s, box-shadow 0.3s",
          boxShadow: holding ? "0 0 30px rgba(220,38,38,0.08), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Fill sweep */}
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: `${progress}%`,
          background: "linear-gradient(90deg, rgba(220,38,38,0.2) 0%, rgba(220,38,38,0.08) 100%)",
          transition: "none",
        }} />
        {/* Top glow line */}
        <div style={{
          position: "absolute", top: 0, left: 0, height: 1,
          width: `${progress}%`,
          background: "linear-gradient(90deg, #dc2626, rgba(220,38,38,0.2))",
          opacity: holding ? 1 : 0,
          transition: "opacity 0.2s",
        }} />
        {/* Label */}
        <span style={{
          position: "relative",
          fontFamily: SF, fontSize: 13, fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: done ? "rgba(255,255,255,0.6)" : holding ? "rgba(220,38,38,0.9)" : "rgba(255,255,255,0.35)",
          transition: "color 0.2s",
        }}>
          {loading ? "Processing..." : done ? "✓  Check-in confirmed" : holding ? "Keep holding..." : "Hold to check in"}
        </span>
      </button>
    </div>
  );
}

// ─── Info panel ────────────────────────────────────────────────────────────

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
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(60px) saturate(180%)",
        WebkitBackdropFilter: "blur(60px) saturate(180%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px 24px 0 0",
        padding: "0 0 48px",
        maxHeight: "82vh", overflowY: "auto",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        fontFamily: SF,
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 2 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
        </div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, background: "rgba(10,10,10,0.9)", backdropFilter: "blur(20px)", zIndex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Details</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 20, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "6px 14px", fontFamily: SF }}>Close</button>
        </div>

        <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Beneficiaries */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Beneficiaries</span>
              <button onClick={onEditBens} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: SF, padding: 0 }}>Edit →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {vault.beneficiaries.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: i < vault.beneficiaries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: "rgba(255,255,255,0.45)" }}>
                    {b.wallet.toBase58().slice(0, 6)}...{b.wallet.toBase58().slice(-4)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>~{(solBal * b.shareBps / 10_000).toFixed(3)} SOL</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)", minWidth: 44, textAlign: "right" }}>{b.shareBps / 100}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Settings */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Settings</span>
              <button onClick={onEditInterval} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: SF, padding: 0 }}>Edit →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { l: "Check-in frequency", v: `Every ${vault.intervalDays} days` },
                { l: "Grace period", v: vault.gracePeriodDays === 0 ? "None" : `+${vault.gracePeriodDays} days` },
              ].map(({ l, v }, i) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{l}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Claim link */}
          <section>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 14 }}>Beneficiary link</span>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "11px 14px", fontSize: 12, fontFamily: MONO, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {claimUrl}
              </div>
              <button onClick={() => navigator.clipboard.writeText(claimUrl)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "11px 18px", fontFamily: SF, flexShrink: 0 }}>Copy</button>
            </div>
          </section>

          {/* Demo */}
          {isDemo && (
            <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(220,38,38,0.5)", display: "block", marginBottom: 14 }}>Demo — Simulate expiry</span>
              <button onClick={onSimulate} disabled={simulating} style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, color: "#ef4444", cursor: simulating ? "default" : "pointer", fontSize: 14, fontWeight: 600, padding: "12px 20px", fontFamily: SF, opacity: simulating ? 0.6 : 1, transition: "all 0.2s" }}>
                {simulating ? "Simulating..." : "☠  Execute distribution"}
              </button>
              {simMsg && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>{simMsg}</p>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "rgba(12,12,12,0.97)", borderRadius: "24px 24px 0 0", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "28px 24px 40px", animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)", fontFamily: SF }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 20, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, padding: "6px 14px", fontFamily: SF }}>Close</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

function EditIntervalModal({ current, grace, onSave, onClose, loading }: { current: number; grace: number; onSave: (d: number, g: number) => void; onClose: () => void; loading: boolean }) {
  const [days, setDays] = useState(current);
  const [gr, setGr] = useState(grace);
  return (
    <Modal title="Check-in interval" onClose={onClose}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Interval</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{ padding: "16px", borderRadius: 14, border: `1px solid ${days === d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.07)"}`, background: days === d ? "rgba(255,255,255,0.08)" : "transparent", color: days === d ? "white" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: SF, transition: "all 0.15s" }}>{d} days</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Grace period</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 3, 7, 14].map(d => (
            <button key={d} onClick={() => setGr(d)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: `1px solid ${gr === d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.07)"}`, background: gr === d ? "rgba(255,255,255,0.08)" : "transparent", color: gr === d ? "white" : "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: SF, transition: "all 0.15s" }}>
              {d === 0 ? "None" : `+${d}d`}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => onSave(days, gr)} disabled={loading} style={{ width: "100%", padding: "15px", borderRadius: 14, background: loading ? "rgba(255,255,255,0.25)" : "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontFamily: SF }}>
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
            <input value={row.wallet} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, wallet: e.target.value } : r))} placeholder="Wallet address" style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 12px", fontSize: 12, color: "white", fontFamily: MONO, outline: "none" }} />
            <input type="number" min={1} max={100} value={row.share} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))} style={{ width: 56, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 6px", fontSize: 13, color: "white", textAlign: "center", fontFamily: SF, outline: "none" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>%</span>
            {rows.length > 1 && <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => rows.length < 5 && setRows(prev => [...prev, { wallet: "", share: 0 }])} disabled={rows.length >= 5} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontFamily: SF, padding: 0 }}>+ Add</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: Math.abs(total - 100) < 0.01 ? "rgba(255,255,255,0.7)" : "#ef4444" }}>{total}%</span>
      </div>
      {error && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</p>}
      <button onClick={() => { const v = validate(); if (v) onSave(v); }} disabled={loading} style={{ width: "100%", padding: "15px", borderRadius: 14, background: loading ? "rgba(255,255,255,0.25)" : "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontFamily: SF }}>
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
      <div style={{ minHeight: "100vh", background: "#060606", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <img src="/logo.png" alt="Afterlife" style={{ width: 44, height: 44, opacity: 0.4 }} />
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>Connect your wallet to continue</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#060606", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.2)" }}>Loading...</p>
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
    <div style={{ minHeight: "100vh", background: "#060606", color: "white", fontFamily: SF, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Subtle center glow matching ring */}
      <div aria-hidden style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${timer.expired ? "rgba(220,38,38,0.04)" : "rgba(255,255,255,0.03)"} 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0, transition: "background 1s" }} />

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", background: "rgba(6,6,6,0.6)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Afterlife" style={{ width: 22, height: 22, objectFit: "contain", opacity: 0.5 }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.02em" }}>Afterlife</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isDemo && <span style={{ fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.2)" }}>{ownerAddr.slice(0, 6)}...{ownerAddr.slice(-4)}</span>}
          <button onClick={() => setInfoOpen(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: SF, padding: 0, letterSpacing: "0.01em", transition: "color 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >Details</button>
          {!isDemo && <WalletMultiButton style={{ fontSize: 12, borderRadius: 20, height: 34 }} />}
        </div>
      </div>

      {/* Main */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 32px 100px", gap: 0 }}>

        {/* Status */}
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: timer.expired ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.22)", marginBottom: 40 }}>
          {timer.expired ? "Distribution triggered" : "Vault active · Solana Devnet"}
        </div>

        {/* Ring */}
        <ProgressRing days={timer.days} hours={timer.hours} mins={timer.mins} secs={timer.secs} pct={timer.pct} expired={timer.expired} />

        {/* % label */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", marginTop: 24, marginBottom: 48, letterSpacing: "0.06em" }}>
          {timer.expired ? "" : `${Math.round(timer.pct)}% remaining`}
        </div>

        {/* Hold button or expired state */}
        {vault.isActive ? (
          <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <HoldButton onConfirm={handleCheckin} loading={checkingIn} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
              Last check-in: {new Date(lastCheckin * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        ) : (
          <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", marginBottom: 8 }}>Distribution executed</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>Assets have been distributed to beneficiaries.</div>
          </div>
        )}
      </div>

      <InfoPanel
        open={infoOpen} onClose={() => setInfoOpen(false)}
        vault={vault} solBal={solBal} publicKey={ownerAddr} isDemo={isDemo}
        onEditInterval={() => { setInfoOpen(false); setTimeout(() => setEditInterval(true), 400); }}
        onEditBens={() => { setInfoOpen(false); setTimeout(() => setEditBens(true), 400); }}
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
