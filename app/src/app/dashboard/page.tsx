"use client";
import { Suspense, useState, useCallback, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Users, Coins, Settings2, AlertTriangle, Copy, Check, ChevronRight } from "lucide-react";
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

type Tab = "status" | "beneficiaries" | "vault" | "settings";

function timeRemaining(lastCheckin: number, intervalDays: number, gracePeriodDays: number) {
  const deadline = lastCheckin + (intervalDays + gracePeriodDays) * 86_400;
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;
  if (remaining <= 0) return { expired: true, days: 0, hours: 0, mins: 0, secs: 0, pct: 0 };
  const total = (intervalDays + gracePeriodDays) * 86_400;
  return {
    expired: false,
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3600),
    mins: Math.floor((remaining % 3600) / 60),
    secs: remaining % 60,
    pct: (remaining / total) * 100,
  };
}

// ─── Modal shell ───────────────────────────────────────────────────────────────

function BottomModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "rgba(12,12,12,0.97)", borderRadius: "24px 24px 0 0", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "28px 24px 40px", fontFamily: SF }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{title}</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 20, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, padding: "6px 14px", fontFamily: SF }}>Close</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function EditIntervalModal({ current, grace, onSave, onClose, loading }: {
  current: number; grace: number; onSave: (d: number, g: number) => void; onClose: () => void; loading: boolean;
}) {
  const [days, setDays] = useState(current);
  const [gr, setGr] = useState(grace);
  return (
    <BottomModal title="Check-in interval" onClose={onClose}>
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
    </BottomModal>
  );
}

function EditBeneficiariesModal({ initialRows, onSave, onClose, loading }: {
  initialRows: Array<{ wallet: string; share: number }>; onSave: (rows: BeneficiaryInput[]) => void; onClose: () => void; loading: boolean;
}) {
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
    <BottomModal title="Edit beneficiaries" onClose={onClose}>
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
    </BottomModal>
  );
}

// ─── Tab: Status ──────────────────────────────────────────────────────────────

function StatusTab({ vault, timer, isDemo, onCheckin, checkingIn, hasPinged, solBal }: {
  vault: VaultData; timer: ReturnType<typeof timeRemaining>; isDemo: boolean;
  onCheckin: () => void; checkingIn: boolean; hasPinged: boolean; solBal: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12 gap-12">

      {/* Timer display */}
      <div>
        <div className="text-center mb-3">
          <span className="text-xs font-mono tracking-widest uppercase text-white/30">
            {timer.expired ? "Protocol triggered" : "Time remaining"}
          </span>
        </div>
        <div className="flex items-end gap-2 md:gap-4">
          {[
            { val: timer.days, label: "Days", opacity: timer.expired ? 0.4 : 0.9 },
            { val: timer.hours, label: "Hrs", opacity: timer.expired ? 0.2 : 0.6 },
            { val: timer.mins, label: "Min", opacity: timer.expired ? 0.15 : 0.4 },
            { val: timer.secs, label: "Sec", opacity: timer.expired ? 0.1 : 0.25 },
          ].map(({ val, label, opacity }, i) => (
            <div key={label} className="flex items-end gap-1 md:gap-2">
              {i > 0 && (
                <span className="text-2xl md:text-4xl font-bold tracking-tighter pb-5 md:pb-7 text-white/20">:</span>
              )}
              <div className="flex flex-col items-center">
                <span
                  className="font-bold tracking-tighter leading-none tabular-nums"
                  style={{
                    fontSize: i === 0 ? "clamp(4rem, 14vw, 7rem)" : i === 1 ? "clamp(2.5rem, 9vw, 4.5rem)" : i === 2 ? "clamp(1.8rem, 6vw, 3rem)" : "clamp(1.2rem, 4vw, 2rem)",
                    opacity,
                    color: timer.expired ? "#ef4444" : "white",
                    transition: "opacity 0.5s",
                    fontFamily: SF,
                  }}
                >
                  {String(val).padStart(2, "0")}
                </span>
                <span className="text-[10px] tracking-widest uppercase text-white/30 mt-1.5" style={{ fontFamily: SF }}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fingerprint button */}
      {vault.isActive && !timer.expired && (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onCheckin}
            disabled={checkingIn || hasPinged}
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-full border transition-all duration-300"
            style={{
              background: hasPinged ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
              borderColor: hasPinged ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              color: hasPinged ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.8)",
              cursor: checkingIn || hasPinged ? "default" : "pointer",
              fontFamily: SF,
              fontSize: 15,
              fontWeight: 600,
              minWidth: 260,
            }}
          >
            <Fingerprint className="w-5 h-5" style={{ opacity: hasPinged ? 0.4 : 0.7 }} />
            {checkingIn ? "Processing..." : hasPinged ? "Life Confirmed ✓" : "Confirm Proof of Life"}
          </button>
          <span className="text-xs text-white/20" style={{ fontFamily: MONO }}>
            Last check-in: {new Date(vault.lastCheckin.toNumber() * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
      )}

      {timer.expired && (
        <div className="text-center max-w-xs">
          <div className="text-sm font-semibold text-red-400 mb-2">Distribution executed</div>
          <div className="text-sm text-white/30 leading-relaxed" style={{ fontFamily: SF }}>
            Assets have been distributed to beneficiaries.
          </div>
        </div>
      )}

      {/* % remaining pill */}
      {!timer.expired && (
        <div className="px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.03]">
          <span className="text-xs font-mono text-white/25">{Math.round(timer.pct)}% remaining</span>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Beneficiaries ───────────────────────────────────────────────────────

function BeneficiariesTab({ vault, solBal, isDemo, onEdit }: {
  vault: VaultData; solBal: number; isDemo: boolean; onEdit: () => void;
}) {
  return (
    <div className="px-4 py-8 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white/80 tracking-tight" style={{ fontFamily: SF }}>Heirs</h2>
        {!isDemo && (
          <button onClick={onEdit} className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1" style={{ fontFamily: SF }}>
            Edit <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {vault.beneficiaries.map((b, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
            <div>
              <div className="text-sm font-mono text-white/50">
                {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-6)}
              </div>
              <div className="text-xs text-white/25 mt-1" style={{ fontFamily: SF }}>
                ~{(solBal * b.shareBps / 10_000).toFixed(3)} SOL estimated
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white/80" style={{ fontFamily: SF }}>{b.shareBps / 100}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Vault ───────────────────────────────────────────────────────────────

function VaultTab({ solBal }: { solBal: number }) {
  const SOL_PRICE = 149.42;
  const usdValue = (solBal * SOL_PRICE).toFixed(2);

  return (
    <div className="px-4 py-8 max-w-xl mx-auto w-full">
      <h2 className="text-lg font-semibold text-white/80 tracking-tight mb-6" style={{ fontFamily: SF }}>Assets</h2>
      <div className="space-y-3">
        <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 397 311" fill="white">
                  <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
                  <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
                  <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-white" style={{ fontFamily: SF }}>SOL</div>
                <div className="text-xs text-white/30" style={{ fontFamily: SF }}>Solana</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-white" style={{ fontFamily: SF }}>{solBal.toFixed(4)}</div>
              <div className="text-xs text-white/30" style={{ fontFamily: SF }}>${usdValue}</div>
            </div>
          </div>
          <div className="h-px bg-white/5 my-3" />
          <div className="text-xs text-white/25 flex items-center gap-1.5" style={{ fontFamily: SF }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" />
            Delegated via SPL Token
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] opacity-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#2775CA] flex items-center justify-center text-white text-xs font-bold">$</div>
              <div>
                <div className="text-sm font-semibold text-white" style={{ fontFamily: SF }}>USDC</div>
                <div className="text-xs text-white/30" style={{ fontFamily: SF }}>USD Coin</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-white/40" style={{ fontFamily: SF }}>—</div>
              <div className="text-xs text-white/20" style={{ fontFamily: SF }}>Not delegated</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab({ vault, isDemo, claimUrl, onEditInterval, onSimulate, simulating, simMsg, onCancel }: {
  vault: VaultData; isDemo: boolean; claimUrl: string;
  onEditInterval: () => void; onSimulate: () => void; simulating: boolean; simMsg: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 py-8 max-w-xl mx-auto w-full space-y-6">

      {/* Interval */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3" style={{ fontFamily: SF }}>Check-in protocol</h3>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <span className="text-sm text-white/50" style={{ fontFamily: SF }}>Frequency</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/80" style={{ fontFamily: SF }}>Every {vault.intervalDays} days</span>
              {!isDemo && (
                <button onClick={onEditInterval} className="text-xs text-white/30 hover:text-white/60 transition-colors" style={{ fontFamily: SF }}>Edit</button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm text-white/50" style={{ fontFamily: SF }}>Grace period</span>
            <span className="text-sm font-semibold text-white/80" style={{ fontFamily: SF }}>
              {vault.gracePeriodDays === 0 ? "None" : `+${vault.gracePeriodDays} days`}
            </span>
          </div>
        </div>
      </div>

      {/* Claim link */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3" style={{ fontFamily: SF }}>Beneficiary link</h3>
        <div className="flex gap-2">
          <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2.5 text-xs font-mono text-white/25 overflow-hidden text-ellipsis whitespace-nowrap">
            {claimUrl}
          </div>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-all text-xs text-white/50 hover:text-white/80" style={{ fontFamily: SF }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Demo: simulate expiry */}
      {isDemo && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-red-500/40 mb-3" style={{ fontFamily: SF }}>Demo</h3>
          <button onClick={onSimulate} disabled={simulating} className="w-full px-4 py-3 rounded-2xl border border-red-500/20 bg-red-500/[0.05] text-red-400 text-sm font-semibold transition-all hover:bg-red-500/10 disabled:opacity-50" style={{ fontFamily: SF }}>
            {simulating ? "Simulating..." : "☠  Execute distribution"}
          </button>
          {simMsg && <p className="text-xs text-white/30 mt-2" style={{ fontFamily: SF }}>{simMsg}</p>}
        </div>
      )}

      {/* Emergency break glass */}
      {!isDemo && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-red-500/40 mb-3" style={{ fontFamily: SF }}>Danger zone</h3>
          <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-500/40 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white/60 mb-1" style={{ fontFamily: SF }}>Emergency Break Glass</div>
                <div className="text-xs text-white/25 leading-relaxed" style={{ fontFamily: SF }}>
                  Permanently cancel your Afterlife vault. This will revoke all delegation authorizations and cannot be undone without redeploying.
                </div>
              </div>
            </div>
            {!showCancel ? (
              <button onClick={() => setShowCancel(true)} className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400/60 text-sm font-medium transition-all hover:border-red-500/40 hover:text-red-400" style={{ fontFamily: SF }}>
                Revoke Protocol
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-400/60 text-center" style={{ fontFamily: SF }}>Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm" style={{ fontFamily: SF }}>Cancel</button>
                  <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold" style={{ fontFamily: SF }}>Confirm</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

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
  const [hasPinged, setHasPinged] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("status");
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
    if (isDemo) { setHasPinged(true); return; }
    if (!publicKey || !wallet) return;
    setCheckingIn(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await checkin(program, publicKey);
      setHasPinged(true);
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

  async function handleCancel() {
    if (!publicKey || !wallet) return;
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await cancelVault(program, publicKey);
      router.push("/");
    } catch (e) { console.error(e); }
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
      <div style={{ minHeight: "100vh", background: "#060606", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontFamily: SF }}>Loading...</p>
      </div>
    );
  }

  if (!vault) return null;

  const lastCheckin = vault.lastCheckin.toNumber();
  const timer = timeRemaining(lastCheckin, vault.intervalDays, vault.gracePeriodDays);
  const ownerAddr = isDemo ? "Demo1111111111111111111111111111111111111111" : publicKey?.toBase58() ?? "";
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim/${ownerAddr}` : "";
  const initialBenRows = vault.beneficiaries.map(b => ({ wallet: b.wallet.toBase58(), share: b.shareBps / 100 }));

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "status", icon: <Fingerprint className="w-4 h-4" />, label: "Status" },
    { id: "beneficiaries", icon: <Users className="w-4 h-4" />, label: "Heirs" },
    { id: "vault", icon: <Coins className="w-4 h-4" />, label: "Vault" },
    { id: "settings", icon: <Settings2 className="w-4 h-4" />, label: "Settings" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060606", color: "white", fontFamily: SF, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Ambient glow */}
      <div aria-hidden style={{ position: "fixed", top: "25%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${timer.expired ? "rgba(220,38,38,0.03)" : "rgba(255,255,255,0.025)"} 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0, transition: "background 1.5s" }} />

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "rgba(6,6,6,0.7)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="Afterlife" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.45 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.3)", letterSpacing: "0.02em" }}>Afterlife</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isDemo && <span style={{ fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.18)" }}>{ownerAddr.slice(0, 6)}...{ownerAddr.slice(-4)}</span>}
          {!isDemo && <WalletMultiButton style={{ fontSize: 12, borderRadius: 20, height: 32 }} />}
          {isDemo && <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-white/5 text-white/20">Demo</span>}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ position: "fixed", top: 64, left: 0, right: 0, zIndex: 25, display: "flex", justifyContent: "center", padding: "12px 24px", background: "rgba(6,6,6,0.5)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-1 p-1 rounded-2xl border border-white/5 bg-white/[0.02]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200"
              style={{
                fontFamily: SF,
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.3)",
                background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                border: activeTab === tab.id ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              }}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, paddingTop: 128 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === "status" && (
              <StatusTab vault={vault} timer={timer} isDemo={isDemo} onCheckin={handleCheckin} checkingIn={checkingIn} hasPinged={hasPinged} solBal={solBal} />
            )}
            {activeTab === "beneficiaries" && (
              <BeneficiariesTab vault={vault} solBal={solBal} isDemo={isDemo} onEdit={() => setEditBens(true)} />
            )}
            {activeTab === "vault" && <VaultTab solBal={solBal} />}
            {activeTab === "settings" && (
              <SettingsTab
                vault={vault} isDemo={isDemo} claimUrl={claimUrl}
                onEditInterval={() => setEditInterval(true)}
                onSimulate={handleSimulate} simulating={simulating} simMsg={simMsg}
                onCancel={handleCancel}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {editInterval && vault && (
        <EditIntervalModal current={vault.intervalDays} grace={vault.gracePeriodDays} onSave={saveInterval} onClose={() => setEditInterval(false)} loading={saving} />
      )}
      {editBens && vault && (
        <EditBeneficiariesModal initialRows={initialBenRows} onSave={saveBeneficiaries} onClose={() => setEditBens(false)} loading={saving} />
      )}
    </div>
  );
}
