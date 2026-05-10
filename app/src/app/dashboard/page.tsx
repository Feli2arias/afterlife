"use client";
import { Suspense, useState, useCallback, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, NATIVE_MINT } from "@solana/spl-token";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Users, Settings, ShieldAlert, ArrowUpRight,
  Copy, Fingerprint, Wallet, Clock, TerminalSquare,
} from "lucide-react";
import {
  getProgram, fetchVaultConfig, forceExpire, executeDistribution,
  cancelVault, registerVault, checkin, BeneficiaryInput,
} from "@/lib/afterlife";
import { wrapAndApproveSOL } from "@/lib/delegate";
import { Transaction } from "@solana/web3.js";
import { useRouter, useSearchParams } from "next/navigation";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

const DEMO_VAULT = {
  owner: { toBase58: () => "Demo1111111111111111111111111111111111111111" },
  beneficiaries: [
    { emailHash: new Array(32).fill(1), shareBps: 5000 },
    { emailHash: new Array(32).fill(2), shareBps: 3000 },
    { emailHash: new Array(32).fill(3), shareBps: 2000 },
  ],
  isActive: true,
  intervalDays: 60,
  gracePeriodDays: 7,
  lastCheckin: { toNumber: () => Math.floor(Date.now() / 1000) - 18 * 86400 },
  executedTotal: { toNumber: () => 0 },
};

type VaultData = {
  owner: { toBase58: () => string };
  beneficiaries: Array<{ emailHash: number[]; shareBps: number }>;
  isActive: boolean;
  intervalDays: number;
  gracePeriodDays: number;
  lastCheckin: { toNumber: () => number };
  executedTotal: { toNumber: () => number };
};

function timeRemaining(lastCheckin: number, intervalDays: number, gracePeriodDays: number) {
  const deadline = lastCheckin + (intervalDays + gracePeriodDays) * 86_400;
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, deadline - now);
  return {
    expired: remaining === 0,
    d: Math.floor(remaining / 86400),
    h: Math.floor((remaining % 86400) / 3600),
    m: Math.floor((remaining % 3600) / 60),
    s: remaining % 60,
  };
}

// ─── Edit modals ──────────────────────────────────────────────────────────────

function BottomModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "rgba(8,8,8,0.97)", borderRadius: "24px 24px 0 0", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "28px 24px 44px", fontFamily: SF }}>
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

function EditIntervalModal({ current, grace, onSave, onClose, loading }: { current: number; grace: number; onSave: (d: number, g: number) => void; onClose: () => void; loading: boolean }) {
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

function EditBeneficiariesModal({ initialRows, onSave, onClose, loading }: { initialRows: Array<{ email: string; share: number }>; onSave: (rows: Array<{ email: string; share: number }>) => void; onClose: () => void; loading: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const total = rows.reduce((s, r) => s + Number(r.share || 0), 0);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate(): Array<{ email: string; share: number }> | null {
    if (Math.abs(total - 100) > 0.01) { setError("Total must be 100%"); return null; }
    for (const row of rows) {
      if (!EMAIL_RE.test(row.email.trim())) { setError(`Invalid email: ${row.email}`); return null; }
    }
    return rows;
  }

  return (
    <BottomModal title="Edit beneficiaries" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="email" value={row.email} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, email: e.target.value } : r))} placeholder="heir@example.com" style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 12px", fontSize: 13, color: "white", fontFamily: SF, outline: "none" }} />
            <input type="number" min={1} max={100} value={row.share} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))} style={{ width: 56, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "11px 6px", fontSize: 13, color: "white", textAlign: "center", fontFamily: SF, outline: "none" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>%</span>
            {rows.length > 1 && <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => rows.length < 5 && setRows(prev => [...prev, { email: "", share: 0 }])} disabled={rows.length >= 5} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontFamily: SF, padding: 0 }}>+ Add</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: Math.abs(total - 100) < 0.01 ? "rgba(255,255,255,0.7)" : "#ef4444" }}>{total}%</span>
      </div>
      {error && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</p>}
      <button onClick={() => { const v = validate(); if (v) onSave(v); }} disabled={loading} style={{ width: "100%", padding: "15px", borderRadius: 14, background: loading ? "rgba(255,255,255,0.25)" : "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", fontFamily: SF }}>
        {loading ? "Saving..." : "Save"}
      </button>
    </BottomModal>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const { publicKey, signTransaction } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";

  const [vault, setVault] = useState<VaultData | null>(isDemo ? DEMO_VAULT as unknown as VaultData : null);
  const [loading, setLoading] = useState(!isDemo);
  const [solBal, setSolBal] = useState(isDemo ? 4.237 : 0);
  const [activeTab, setActiveTab] = useState<"status" | "beneficiaries" | "vault" | "settings">("status");
  const [hasPinged, setHasPinged] = useState(false);
  const [editInterval, setEditInterval] = useState(false);
  const [editBens, setEditBens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [demoCountdownEnd, setDemoCountdownEnd] = useState<number | null>(null);
  const [autoExecuting, setAutoExecuting] = useState(false);
  const [autoExecError, setAutoExecError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [heirEmails, setHeirEmails] = useState<{ email: string; name: string; share: number }[]>([]);

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
    try {
      const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, publicKey);
      const wsolAcc = await getAccount(connection, wsolAta);
      setSolBal(Number(wsolAcc.amount) / LAMPORTS_PER_SOL);
    } catch {
      const bal = await connection.getBalance(publicKey);
      setSolBal(bal / LAMPORTS_PER_SOL);
    }
    setLoading(false);
  }, [publicKey, wallet, connection, router, isDemo]);

  useEffect(() => {
    loadVault();
    if (!isDemo && publicKey) {
      const stored = sessionStorage.getItem(`afterlife_heirs_${publicKey.toBase58()}`);
      if (stored) setHeirEmails(JSON.parse(stored));
      const testKey = `afterlife_test_30s_${publicKey.toBase58()}`;
      if (sessionStorage.getItem(testKey)) {
        sessionStorage.removeItem(testKey);
        setDemoCountdownEnd(Date.now() + 30_000);
      }
    }
  }, [loadVault, isDemo, publicKey]);

  // Auto-execute protocol when 1-min demo countdown reaches zero
  useEffect(() => {
    if (!demoCountdownEnd || autoExecuting || !publicKey || !wallet) return;
    if (Date.now() < demoCountdownEnd) return;
    setAutoExecuting(true);
    setDemoCountdownEnd(null); // clear before async work to prevent re-triggering
    (async () => {
      try {
        const provider = new AnchorProvider(connection, wallet, {});
        const program = getProgram(provider);
        await forceExpire(program, publicKey);
        await executeDistribution(program, publicKey, publicKey);
        await loadVault();
        const stored = sessionStorage.getItem(`afterlife_heirs_${publicKey.toBase58()}`);
        if (stored) {
          const heirs: { email: string; name: string; share: number }[] = JSON.parse(stored);
          const origin = window.location.origin;
          await Promise.allSettled(heirs.map((h, idx) =>
            fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: h.email, name: h.name, share: h.share,
                ownerAddress: publicKey.toBase58(),
                claimUrl: `${origin}/claim/${publicKey.toBase58()}?heir=${idx}`,
              }),
            })
          ));
          setEmailSent(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[auto-execute]", msg);
        setAutoExecError(msg);
        await loadVault();
      }
      finally { setAutoExecuting(false); }
    })();
  }, [tick, demoCountdownEnd, autoExecuting, publicKey, wallet, connection, loadVault]);

  async function handleCheckin() {
    if (isDemo) {
      setHasPinged(true);
      setTimeout(() => setHasPinged(false), 3000);
      return;
    }
    if (!publicKey || !wallet) return;
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await checkin(program, publicKey);
      setHasPinged(true);
      setTimeout(() => setHasPinged(false), 3000);
      await loadVault();
    } catch (e) { console.error(e); }
  }

  async function saveInterval(days: number, grace: number) {
    if (!publicKey || !wallet || !vault) return;
    setSaving(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      const backendAuthority = new PublicKey(
        (process.env.NEXT_PUBLIC_KEEPER_PUBKEY ?? "4FbVVCDGNPLG69a1DBnLm1NXotJ8ZusvUi67uamx8orP").trim()
      );
      await cancelVault(program, publicKey);
      // Reuse existing email hashes directly from vault (no need to reverse-hash)
      const bens: BeneficiaryInput[] = vault.beneficiaries.map(b => ({
        emailHash: Array.from(b.emailHash),
        shareBps: b.shareBps,
      }));
      await registerVault(program, publicKey, bens, days, grace, backendAuthority);
      setEditInterval(false);
      await loadVault();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function saveBeneficiaries(rows: Array<{ email: string; share: number }>) {
    if (!publicKey || !wallet || !vault) return;
    setSaving(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      const backendAuthority = new PublicKey(
        (process.env.NEXT_PUBLIC_KEEPER_PUBKEY ?? "4FbVVCDGNPLG69a1DBnLm1NXotJ8ZusvUi67uamx8orP").trim()
      );
      await cancelVault(program, publicKey);
      const newBens: BeneficiaryInput[] = await Promise.all(rows.map(async r => {
        const encoder = new TextEncoder();
        const data = encoder.encode(r.email.trim().toLowerCase());
        const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer.slice(0) as ArrayBuffer);
        return { emailHash: Array.from(new Uint8Array(hashBuffer)), shareBps: Math.round(r.share * 100) };
      }));
      await registerVault(program, publicKey, newBens, vault.intervalDays, vault.gracePeriodDays, backendAuthority);
      // Update session storage with new emails
      const stored = sessionStorage.getItem(`afterlife_heirs_${publicKey.toBase58()}`);
      const existing = stored ? JSON.parse(stored) : [];
      const updated = rows.map((r, i) => ({ email: r.email, name: existing[i]?.name ?? "", share: r.share }));
      sessionStorage.setItem(`afterlife_heirs_${publicKey.toBase58()}`, JSON.stringify(updated));
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
      await loadVault();
      const stored = sessionStorage.getItem(`afterlife_heirs_${publicKey.toBase58()}`);
      if (stored) {
        setSimMsg("Sending emails...");
        const heirs: { email: string; name: string; share: number }[] = JSON.parse(stored);
        const origin = window.location.origin;
        await Promise.allSettled(heirs.map((h, idx) =>
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: h.email, name: h.name, share: h.share,
              ownerAddress: publicKey.toBase58(),
              claimUrl: `${origin}/claim/${publicKey.toBase58()}?heir=${idx}`,
            }),
          })
        ));
        setEmailSent(true);
      }
      setSimMsg("Done");
    } catch (e) { setSimMsg("Error: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSimulating(false); }
  }

  async function handleAuthorize() {
    if (!publicKey || !signTransaction) return;
    setAuthorizing(true); setAuthMsg("");
    try {
      const nativeBal = await connection.getBalance(publicKey);
      const lamports = BigInt(nativeBal - 50_000_000); // keep 0.05 SOL for fees
      if (lamports <= 0n) { setAuthMsg("Not enough SOL for fees"); return; }
      await wrapAndApproveSOL(connection, publicKey, lamports, signTransaction as (tx: Transaction) => Promise<Transaction>);
      setAuthMsg("Authorized ✓");
      await loadVault();
    } catch (e) { setAuthMsg("Error: " + (e instanceof Error ? e.message : String(e))); }
    finally { setAuthorizing(false); }
  }

  async function handleRevoke() {
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
      <div className="min-h-screen bg-[#030303] flex items-center justify-center" style={{ fontFamily: SF }}>
        <div className="bg-noise fixed inset-0 z-[100] pointer-events-none mix-blend-overlay" />
        <div className="flex flex-col items-center gap-6 text-center">
          <img src="/logo.png" alt="Afterlife" className="w-11 h-11 opacity-40" />
          <p className="text-white/30 text-sm">Connect your wallet to continue</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="bg-noise fixed inset-0 z-[100] pointer-events-none mix-blend-overlay" />
        <p className="text-white/20 text-sm" style={{ fontFamily: SF }}>Loading...</p>
      </div>
    );
  }

  if (!vault) return null;

  const t = demoCountdownEnd
    ? (() => {
        const rem = Math.max(0, Math.floor((demoCountdownEnd - Date.now()) / 1000));
        return { expired: rem === 0, d: 0, h: 0, m: Math.floor(rem / 60), s: rem % 60 };
      })()
    : autoExecuting
    ? { expired: true, d: 0, h: 0, m: 0, s: 0 }
    : timeRemaining(vault.lastCheckin.toNumber(), vault.intervalDays, vault.gracePeriodDays);
  const ownerAddr = isDemo ? "Demo1111111111111111111111111111111111111111" : publicKey?.toBase58() ?? "";
  const shortAddr = `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}`;
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim/${ownerAddr}` : "";
  const initialBenRows = vault.beneficiaries.map((_, idx) => ({
    email: heirEmails[idx]?.email ?? "",
    share: vault.beneficiaries[idx].shareBps / 100,
  }));

  return (
    <div className="min-h-screen bg-[#030303] text-white" style={{ fontFamily: SF }}>
      <div className="bg-noise fixed inset-0 z-[100] pointer-events-none mix-blend-overlay" />

      <style>{`
        @keyframes scan {
          0% { left: 0; opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>

      <div className="min-h-screen pt-24 pb-20 px-6 flex flex-col items-center relative z-10 selection:bg-white/20">

        {/* Top nav */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center gap-6 mb-20"
        >
          {/* Wallet address */}
          <div className="flex items-center gap-2 text-white/50 text-sm font-mono tracking-widest border border-white/5 px-4 py-2 rounded-full bg-white/[0.02]" style={{ fontFamily: MONO }}>
            <TerminalSquare className="w-4 h-4" />
            {shortAddr}
            <button
              onClick={() => { navigator.clipboard.writeText(ownerAddr); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="hover:text-white transition-colors ml-2"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* Tab pills */}
          <div className="flex items-center p-1 border border-white/10 rounded-full bg-white/[0.02] backdrop-blur-md">
            {(["status", "beneficiaries", "vault", "settings"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-full text-sm font-medium tracking-wide transition-all ${
                  activeTab === tab
                    ? "bg-white text-black shadow-lg"
                    : "text-[#888] hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Wallet button (real mode) */}
          {!isDemo && <WalletMultiButton style={{ fontSize: 12, borderRadius: 20, height: 36 }} />}
        </motion.nav>

        <div className="w-full max-w-5xl flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">

            {/* ── STATUS ─────────────────────────────────────────────── */}
            {activeTab === "status" && (
              <motion.div
                key="status"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: "anticipate" }}
                className="flex-1 flex flex-col items-center justify-center text-center mt-10"
              >
                {/* Pulse glow */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[-1]">
                  <div className={`w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] transition-all duration-[3000ms] ${hasPinged ? "bg-white/10 scale-110" : "bg-[#030303] scale-100"}`} />
                </div>

                <div className="mb-6 flex flex-col items-center">
                  <p className="text-[#666] font-mono text-sm tracking-[0.3em] uppercase mb-12" style={{ fontFamily: MONO }}>
                    {t.expired ? "Protocol has been executed" : "Time until protocol execution"}
                  </p>
                  <div className="flex items-baseline justify-center gap-4 md:gap-8 font-mono text-white mb-20">
                    <div className="flex flex-col items-center">
                      <span className="text-7xl md:text-[9rem] font-bold tracking-tighter leading-none opacity-90">
                        {t.d.toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs text-[#555] uppercase tracking-widest mt-4">Days</span>
                    </div>
                    <span className="text-5xl md:text-7xl text-white/20 -translate-y-6">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-7xl md:text-[9rem] font-bold tracking-tighter leading-none opacity-70">
                        {t.h.toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs text-[#555] uppercase tracking-widest mt-4">Hours</span>
                    </div>
                    <span className="text-5xl md:text-7xl text-white/20 -translate-y-6">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-7xl md:text-[9rem] font-bold tracking-tighter leading-none opacity-50">
                        {t.m.toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs text-[#555] uppercase tracking-widest mt-4">Mins</span>
                    </div>
                    <span className="text-5xl md:text-7xl text-white/20 -translate-y-6">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-7xl md:text-[9rem] font-bold tracking-tighter leading-none opacity-30">
                        {t.s.toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs text-[#555] uppercase tracking-widest mt-4">Secs</span>
                    </div>
                  </div>
                </div>

                {vault.isActive && (
                  <motion.button
                    onClick={handleCheckin}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative overflow-hidden group flex items-center gap-4 px-10 py-6 rounded-full border ${
                      hasPinged
                        ? "border-green-500/50 bg-green-500/10 text-green-400"
                        : "border-white/20 bg-white/5 text-white hover:bg-white hover:text-black hover:border-white shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)]"
                    } transition-all duration-500`}
                  >
                    {!hasPinged && (
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    )}
                    <Fingerprint className={`w-8 h-8 relative z-10 ${hasPinged ? "animate-pulse" : "opacity-80 group-hover:opacity-100 group-hover:text-black"}`} />
                    <span className="relative z-10 text-xl font-bold tracking-widest uppercase">
                      {hasPinged ? "Proof Confirmed" : "Confirm Proof of Life"}
                    </span>
                    {!hasPinged && (
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-white opacity-0 group-hover:opacity-50 group-hover:animate-[scan_2s_ease-in-out_infinite]" />
                    )}
                  </motion.button>
                )}

                {demoCountdownEnd && (
                  <p className="mt-6 text-xs text-amber-400/60 animate-pulse">
                    {autoExecuting ? "Executing protocol..." : "Protocol executes in less than 1 minute..."}
                  </p>
                )}

                {emailSent && (
                  <p className="mt-4 text-xs text-green-400/60">
                    ✓ Heir notified by email
                  </p>
                )}

                {autoExecError && (
                  <p className="mt-4 text-xs text-red-400/70 max-w-xs text-center">
                    ✗ {autoExecError}
                  </p>
                )}

                {!vault.isActive && (
                  <div className="text-center">
                    <p className="text-red-400 font-semibold text-lg mb-2">Distribution executed</p>
                    <p className="text-white/30 text-sm">Assets have been distributed to beneficiaries.</p>
                  </div>
                )}

                <p className="mt-8 text-xs font-mono text-[#444] tracking-widest uppercase" style={{ fontFamily: MONO }}>
                  Contract Status:{" "}
                  <span className={hasPinged ? "text-green-500" : t.expired ? "text-red-500" : "text-white"}>
                    {hasPinged ? "Confirmed" : t.expired ? "Triggered" : "Guarding"}
                  </span>
                </p>
              </motion.div>
            )}

            {/* ── BENEFICIARIES ──────────────────────────────────────── */}
            {activeTab === "beneficiaries" && (
              <motion.div
                key="beneficiaries"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 md:p-12 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                        <Users className="w-8 h-8 opacity-50" /> Heirs &amp; Beneficiaries
                      </h2>
                      <p className="text-[#888] font-medium">Those designated to inherit your secured assets.</p>
                    </div>
                    {!isDemo && (
                      <button onClick={() => setEditBens(true)} className="text-sm font-medium border border-white/20 px-6 py-3 rounded-full hover:bg-white hover:text-black text-white transition-all shadow-lg">
                        + Add Beneficiary
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    {vault.beneficiaries.map((b, idx) => {
                      const heirClaimUrl = typeof window !== "undefined"
                        ? `${window.location.origin}/claim/${ownerAddr}?heir=${idx}`
                        : "";
                      return (
                        <div key={idx} className="flex flex-col md:flex-row justify-between md:items-center p-6 rounded-2xl bg-[#080808] border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.02] gap-6">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center font-mono text-[#888]" style={{ fontFamily: MONO }}>
                              0{idx + 1}
                            </div>
                            <div>
                              <p className="text-white text-lg">
                                {heirEmails[idx]?.email || `Heir ${idx + 1}`}
                              </p>
                              <p className="text-sm text-[#666] tracking-widest mt-1 uppercase font-semibold">
                                ~{(solBal * b.shareBps / 10_000).toFixed(3)} SOL
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[#888] text-xs uppercase tracking-widest mb-1">Allocation</p>
                              <p className="text-3xl text-white font-bold tracking-tighter">
                                {b.shareBps / 100}<span className="text-white/50 text-xl">%</span>
                              </p>
                            </div>
                            {!isDemo && heirClaimUrl && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(heirClaimUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                className="flex items-center gap-1.5 text-xs border border-white/10 px-3 py-2 rounded-full hover:bg-white hover:text-black text-white/40 transition-all"
                                title="Copy claim link for this heir"
                              >
                                <Copy className="w-3 h-3" /> Link
                              </button>
                            )}
                            {!isDemo && (
                              <button onClick={() => setEditBens(true)} className="w-12 h-12 flex items-center justify-center rounded-full border border-white/10 hover:bg-white hover:text-black transition-colors text-white/50">
                                <Settings className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── VAULT ──────────────────────────────────────────────── */}
            {activeTab === "vault" && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 md:p-12 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                        <Wallet className="w-8 h-8 opacity-50" /> Secured Vault
                      </h2>
                      <p className="text-[#888] font-medium">Assets currently governed by your inheritance protocol.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#888] uppercase tracking-widest mb-1">Total Value</p>
                      <p className="text-4xl font-bold tracking-tighter text-white flex items-center justify-end gap-2">
                        <ArrowUpRight className="w-6 h-6 text-white/50" />
                        {solBal.toFixed(3)}<span className="text-xl text-white/30"> SOL</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#080808] border border-white/5 rounded-2xl p-8 hover:border-white/20 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-indigo-400 font-bold text-sm">SOL</span>
                        </div>
                        <p className="font-mono text-indigo-400/50 text-sm" style={{ fontFamily: MONO }}>NATIVE</p>
                      </div>
                      <p className="text-4xl font-bold text-white tracking-tighter mb-1">
                        {solBal.toFixed(4)}<span className="text-xl text-[#666]"> SOL</span>
                      </p>
                      <p className="text-[#888] font-medium">Delegated via wSOL</p>
                    </div>

                    <div className="bg-[#080808] border border-white/5 rounded-2xl p-8 hover:border-white/20 transition-all opacity-50">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <span className="text-blue-400 font-bold">$</span>
                        </div>
                        <p className="font-mono text-blue-400/50 text-sm" style={{ fontFamily: MONO }}>SPL TOKEN</p>
                      </div>
                      <p className="text-4xl font-bold text-white tracking-tighter mb-1">
                        —<span className="text-xl text-[#666]"> USDC</span>
                      </p>
                      <p className="text-[#888] font-medium">Not delegated</p>
                    </div>
                  </div>

                  {!isDemo && (
                    <div className="mt-6 flex items-center gap-4">
                      <button
                        onClick={handleAuthorize}
                        disabled={authorizing}
                        className="px-6 py-3 rounded-full bg-white/[0.05] border border-white/10 text-white/70 text-sm font-semibold hover:bg-white hover:text-black transition-all disabled:opacity-40"
                      >
                        {authorizing ? "Authorizing..." : "Authorize / Re-authorize SOL"}
                      </button>
                      {authMsg && <p className="text-xs text-white/40">{authMsg}</p>}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── SETTINGS ───────────────────────────────────────────── */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 md:p-12 backdrop-blur-xl">
                  <h2 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                    <Settings className="w-8 h-8 opacity-50" /> Protocol Settings
                  </h2>
                  <p className="text-[#888] font-medium mb-10 border-b border-white/10 pb-6">
                    Modify the core rules of your inheritance protocol.
                  </p>

                  <div className="space-y-8 max-w-2xl">

                    {/* Interval */}
                    <div>
                      <h3 className="text-sm uppercase tracking-widest text-white/50 mb-3">Proof of Life Interval</h3>
                      <div className="bg-[#080808] border border-white/10 rounded-xl p-4 flex justify-between items-center text-white">
                        <span className="text-lg">Every {vault.intervalDays} Days</span>
                        {!isDemo && (
                          <button onClick={() => setEditInterval(true)} className="text-sm underline decoration-white/20 hover:decoration-white transition-all text-[#888] hover:text-white">
                            Change
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Claim link */}
                    <div>
                      <h3 className="text-sm uppercase tracking-widest text-white/50 mb-3">Beneficiary Claim Links</h3>
                      <div className="bg-[#080808] border border-white/10 rounded-xl p-4">
                        <p className="text-xs text-white/30 mb-3">Each heir gets a personalized link. Copy individual links from the Beneficiaries tab.</p>
                        <div className="flex gap-3 items-center">
                          <span className="flex-1 text-sm font-mono text-white/20 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontFamily: MONO }}>{claimUrl}?heir=0</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(claimUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            className="text-sm border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black text-white/60 transition-all flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Base URL"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Demo simulate */}
                    {isDemo && (
                      <div>
                        <h3 className="text-sm uppercase tracking-widest text-red-500/50 mb-3">Demo — Simulate expiry</h3>
                        <button onClick={handleSimulate} disabled={simulating} className="px-6 py-3 rounded-full bg-red-500/10 text-red-400 font-semibold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                          {simulating ? "Simulating..." : "☠  Execute distribution"}
                        </button>
                        {simMsg && <p className="text-xs text-white/30 mt-3" style={{ fontFamily: SF }}>{simMsg}</p>}
                      </div>
                    )}

                    {/* Emergency break glass */}
                    <div>
                      <h3 className="text-sm uppercase tracking-widest text-white/50 mb-3">Emergency Break Glass</h3>
                      <div className="bg-[#080808] border border-red-500/20 rounded-xl p-6 flex items-start gap-6">
                        <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
                        <div>
                          <p className="text-white font-medium mb-2">Revoke Protocol Instantly</p>
                          <p className="text-sm text-[#888] mb-4">
                            This will cancel the inheritance plan and return all parameters to default. Secured assets remain untouched in your wallet.
                          </p>
                          {!isDemo ? (
                            <button onClick={handleRevoke} className="px-6 py-3 rounded-full bg-red-500/10 text-red-500 font-semibold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">
                              Revoke Protocol
                            </button>
                          ) : (
                            <button disabled className="px-6 py-3 rounded-full bg-red-500/10 text-red-500/40 font-semibold border border-red-500/10 cursor-default">
                              Revoke Protocol
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
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
