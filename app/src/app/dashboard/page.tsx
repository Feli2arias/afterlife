"use client";
import { useEffect, useState, useCallback } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getProgram, fetchVaultConfig, forceExpire, executeDistribution,
  cancelVault, registerVault, checkin, BeneficiaryInput,
} from "@/lib/vigil";
import { useRouter } from "next/navigation";

// ─── Style tokens ─────────────────────────────────────────────────────────
const G = {
  bg: "#030303", glass: "rgba(200,200,200,0.04)", glassBorder: "rgba(255,255,255,0.08)",
  emerald: "#10b981", emeraldDim: "rgba(16,185,129,0.1)", emeraldBorder: "rgba(16,185,129,0.2)",
  text: "#ffffff", textMuted: "#a1a1aa", textDim: "#52525b",
  inputBg: "rgba(255,255,255,0.03)", inputBorder: "rgba(255,255,255,0.08)",
  danger: "#ef4444",
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
  if (remaining <= 0) return { expired: true, days: 0, hours: 0, pct: 0 };
  const total = (intervalDays + gracePeriodDays) * 86_400;
  return { expired: false, days: Math.floor(remaining / 86_400), hours: Math.floor((remaining % 86_400) / 3600), pct: Math.round((remaining / total) * 100) };
}

// ─── Modal ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="liquid-glass-dark" style={{ width: "100%", maxWidth: 480, borderRadius: 24, padding: "32px 28px", animation: "modalIn 0.2s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.textDim, cursor: "pointer", fontSize: 22, padding: 4 }}>×</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─── EditIntervalModal ────────────────────────────────────────────────────
function EditIntervalModal({ current, grace, onSave, onClose, loading }: { current: number; grace: number; onSave: (days: number, grace: number) => void; onClose: () => void; loading: boolean }) {
  const [days, setDays] = useState(current);
  const [gr, setGr] = useState(grace);
  return (
    <Modal title="Modificar check-in" onClose={onClose}>
      <p style={{ fontSize: 13, color: G.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        Cambia la frecuencia con la que debés confirmar que seguís vivo. Se cancelará y recreará tu vault.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: "14px 8px", borderRadius: 12, border: `2px solid ${days === d ? G.emerald : G.glassBorder}`, background: days === d ? G.emeraldDim : "transparent", color: days === d ? G.text : G.textMuted, cursor: "pointer", fontWeight: days === d ? 700 : 400, fontSize: 14, transition: "all 0.2s" }}>
            {d} días
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[0, 3, 7, 14].map(d => (
          <button key={d} onClick={() => setGr(d)}
            style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${gr === d ? G.emerald : G.glassBorder}`, background: gr === d ? G.emeraldDim : "transparent", color: gr === d ? G.emerald : G.textDim, fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}>
            {d === 0 ? "Sin gracia" : `+${d}d`}
          </button>
        ))}
      </div>
      <button onClick={() => onSave(days, gr)} disabled={loading}
        style={{ width: "100%", padding: "13px", borderRadius: 12, background: loading ? "rgba(16,185,129,0.5)" : G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer", transition: "all 0.2s" }}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </button>
    </Modal>
  );
}

// ─── EditBeneficiariesModal ───────────────────────────────────────────────
function EditBeneficiariesModal({ initialRows, onSave, onClose, loading }: { initialRows: Array<{ wallet: string; share: number }>; onSave: (rows: BeneficiaryInput[]) => void; onClose: () => void; loading: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const total = rows.reduce((s, r) => s + Number(r.share || 0), 0);

  function validate(): BeneficiaryInput[] | null {
    if (Math.abs(total - 100) > 0.01) { setError("Los porcentajes deben sumar 100%"); return null; }
    const result: BeneficiaryInput[] = [];
    for (const row of rows) {
      try { result.push({ wallet: new PublicKey(row.wallet.trim()), shareBps: Math.round(row.share * 100) }); }
      catch { setError(`Wallet inválida: ${row.wallet.slice(0, 20)}`); return null; }
    }
    return result;
  }

  return (
    <Modal title="Editar beneficiarios" onClose={onClose}>
      <p style={{ fontSize: 13, color: G.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Al guardar, se cancelará y recreará tu vault con la nueva configuración.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={row.wallet}
              onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, wallet: e.target.value } : r))}
              placeholder="Wallet address"
              style={{ flex: 1, background: G.inputBg, border: `1px solid ${G.inputBorder}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: G.text, fontFamily: "monospace", outline: "none" }} />
            <input type="number" min={1} max={100} value={row.share}
              onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))}
              style={{ width: 60, background: G.inputBg, border: `1px solid ${G.inputBorder}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: G.text, textAlign: "center", outline: "none" }} />
            <span style={{ fontSize: 12, color: G.textDim }}>%</span>
            {rows.length > 1 && (
              <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                style={{ background: "none", border: "none", color: G.textDim, cursor: "pointer", fontSize: 16 }}>×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={() => rows.length < 5 && setRows(prev => [...prev, { wallet: "", share: 0 }])}
          disabled={rows.length >= 5}
          style={{ background: "none", border: "none", color: G.emerald, cursor: "pointer", fontSize: 13, padding: 0 }}>
          + Agregar
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: Math.abs(total - 100) < 0.01 ? G.emerald : G.danger }}>{total}%</span>
      </div>
      {error && <p style={{ fontSize: 12, color: G.danger, marginBottom: 12 }}>{error}</p>}
      <button onClick={() => { const v = validate(); if (v) onSave(v); }} disabled={loading}
        style={{ width: "100%", padding: "13px", borderRadius: 12, background: loading ? "rgba(16,185,129,0.5)" : G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "default" : "pointer" }}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </button>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [solBal, setSolBal] = useState(0);

  // Modals
  const [editInterval, setEditInterval] = useState(false);
  const [editBens, setEditBens] = useState(false);
  const [saving, setSaving] = useState(false);

  // Simulation
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState("");

  const loadVault = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    const data = await fetchVaultConfig(program, publicKey);
    if (!data) { router.push("/setup"); return; }
    setVault(data as unknown as VaultData);
    const bal = await connection.getBalance(publicKey);
    setSolBal(bal / LAMPORTS_PER_SOL);
    setLoading(false);
  }, [publicKey, wallet, connection, router]);

  useEffect(() => { loadVault(); }, [loadVault]);

  // ── Edit helpers ──────────────────────────────────────────────────────
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

  async function handleCheckin() {
    if (!publicKey || !wallet) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    await checkin(program, publicKey);
    await loadVault();
  }

  async function handleSimulateDeath() {
    if (!publicKey || !wallet) return;
    setSimulating(true); setSimMsg("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      setSimMsg("Backdateando timer...");
      await forceExpire(program, publicKey);
      setSimMsg("Ejecutando distribución...");
      await executeDistribution(program, publicKey, publicKey);
      setSimMsg("✓ Distribución ejecutada");
      await loadVault();
    } catch (e) { setSimMsg("Error: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSimulating(false); }
  }

  // ── States ───────────────────────────────────────────────────────────
  if (!publicKey) {
    return (
      <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif" }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ color: G.textMuted, marginBottom: 16, fontSize: 15 }}>Conectá tu wallet para ver tu dashboard</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.6)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!vault) return null;

  const lastCheckin = vault.lastCheckin.toNumber();
  const timer = timeRemaining(lastCheckin, vault.intervalDays, vault.gracePeriodDays);
  const isActive = vault.isActive;
  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim/${publicKey.toBase58()}` : "";

  const initialBenRows = vault.beneficiaries.map(b => ({
    wallet: b.wallet.toBase58(),
    share: b.shareBps / 100,
  }));

  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif", padding: "0 20px 60px", position: "relative", overflow: "hidden" }}>

      {/* Noise */}
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Ambient blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 65%)", top: "-15%", left: "-10%", animation: "blob1 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.015) 0%, transparent 65%)", bottom: "0", right: "0", animation: "blob2 22s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}}@keyframes blob2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,15px)}}`}</style>

      {/* Navbar */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 720, margin: "0 auto", paddingTop: 24, paddingBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <img src="/logo.png" alt="Vigil" style={{ width: 24, height: 24, objectFit: "contain" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Vigil</span>
          </a>
        </div>
        <WalletMultiButton style={{ fontSize: 13 }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status banner */}
        <div style={{ background: isActive ? G.glass : "rgba(239,68,68,0.06)", border: `1px solid ${isActive ? G.glassBorder : "rgba(239,68,68,0.2)"}`, borderRadius: 20, padding: "20px 24px", backdropFilter: "blur(50px) saturate(200%)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? G.emerald : G.danger, boxShadow: `0 0 8px ${isActive ? G.emerald : G.danger}` }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: isActive ? G.text : G.danger }}>
                {isActive ? "Vault activo" : "Vault inactivo — distribución ejecutada"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: G.textDim, margin: 0 }}>
              {isActive ? `Wallet: ${publicKey.toBase58().slice(0, 8)}...${publicKey.toBase58().slice(-6)}` : "Los activos fueron enviados a tus beneficiarios."}
            </p>
          </div>
          {!isActive && (
            <button
              onClick={async () => {
                if (!publicKey || !wallet) return;
                const provider = new AnchorProvider(connection, wallet, {});
                const program = getProgram(provider);
                await cancelVault(program, publicKey);
                router.push("/setup");
              }}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: G.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Configurar nuevo
            </button>
          )}
        </div>

        {isActive && (
          <>
            {/* Timer + check-in */}
            <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 20, padding: "24px", backdropFilter: "blur(50px) saturate(200%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Tiempo hasta vencimiento</div>
                  {timer.expired ? (
                    <div style={{ fontSize: 22, fontWeight: 800, color: G.danger }}>¡Vencido!</div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>{timer.days}</span>
                      <span style={{ fontSize: 14, color: G.textMuted }}>días</span>
                      <span style={{ fontSize: 24, fontWeight: 700, marginLeft: 4 }}>{String(timer.hours).padStart(2, "0")}</span>
                      <span style={{ fontSize: 14, color: G.textMuted }}>hs</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: G.textDim, marginTop: 4 }}>
                    Último check-in: {new Date(lastCheckin * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>

                {/* Circular progress */}
                <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke={timer.pct > 30 ? G.emerald : G.danger} strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - timer.pct / 100)}`}
                      strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{timer.pct}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginBottom: 20 }}>
                <div style={{ height: "100%", width: `${timer.pct}%`, background: timer.pct > 30 ? G.emerald : G.danger, borderRadius: 99, transition: "width 1s ease" }} />
              </div>

              <button
                onClick={handleCheckin}
                style={{ width: "100%", padding: "14px", borderRadius: 14, background: G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                onMouseLeave={e => (e.currentTarget.style.background = G.emerald)}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.5)", boxShadow: "0 0 6px white" }} />
                Estoy vivo — hacer check-in
              </button>
            </div>

            {/* Beneficiaries */}
            <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 20, padding: "24px", backdropFilter: "blur(50px) saturate(200%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Beneficiarios</div>
                <button onClick={() => setEditBens(true)}
                  style={{ background: "none", border: `1px solid ${G.glassBorder}`, borderRadius: 8, padding: "5px 12px", color: G.textMuted, fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = G.emeraldBorder)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = G.glassBorder)}
                >Editar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {vault.beneficiaries.map((b, i) => {
                  const pct = b.shareBps / 100;
                  const solAmount = (solBal * b.shareBps / 10_000).toFixed(4);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: G.emeraldDim, border: `1px solid ${G.emeraldBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: G.emerald, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: G.textMuted, fontFamily: "monospace" }}>
                            {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-6)}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: G.emerald }}>{pct}% · ~{solAmount} SOL</span>
                        </div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: G.emerald, borderRadius: 99, opacity: 0.7 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settings */}
            <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 20, padding: "24px", backdropFilter: "blur(50px) saturate(200%)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Configuración</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Frecuencia de check-in", val: `Cada ${vault.intervalDays} días` },
                  { label: "Período de gracia", val: vault.gracePeriodDays === 0 ? "Sin gracia" : `+${vault.gracePeriodDays} días` },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${G.glassBorder}`, borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: G.textDim, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{val}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setEditInterval(true)}
                style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 12, background: "transparent", border: `1px solid ${G.glassBorder}`, color: G.textMuted, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = G.emeraldBorder; e.currentTarget.style.color = G.emerald; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = G.glassBorder; e.currentTarget.style.color = G.textMuted; }}
              >Modificar frecuencia de check-in</button>
            </div>

            {/* Claim link */}
            <div style={{ background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 20, padding: "20px 24px", backdropFilter: "blur(50px) saturate(200%)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Link para beneficiarios</div>
                <div style={{ fontSize: 12, color: G.textMuted, fontFamily: "monospace" }}>{claimUrl.slice(0, 50)}...</div>
              </div>
              <button onClick={() => navigator.clipboard.writeText(claimUrl)}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${G.glassBorder}`, background: "transparent", color: G.textMuted, fontSize: 12, cursor: "pointer", transition: "all 0.2s", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = G.emeraldBorder; e.currentTarget.style.color = G.emerald; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = G.glassBorder; e.currentTarget.style.color = G.textMuted; }}
              >Copiar link</button>
            </div>

            {/* Demo: simulate death */}
            <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 20, padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: G.danger, marginBottom: 4 }}>Simular muerte (demo)</div>
              <p style={{ fontSize: 12, color: G.textDim, marginBottom: 14, lineHeight: 1.5 }}>Expira el timer forzosamente y ejecuta la distribución en devnet.</p>
              <button onClick={handleSimulateDeath} disabled={simulating}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: simulating ? "rgba(239,68,68,0.1)" : "transparent", color: G.danger, fontSize: 13, fontWeight: 600, cursor: simulating ? "default" : "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => !simulating && (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                onMouseLeave={e => !simulating && (e.currentTarget.style.background = "transparent")}
              >{simulating ? "Simulando..." : "☠ Simular que morí"}</button>
              {simMsg && <p style={{ fontSize: 12, color: simMsg.startsWith("Error") ? G.danger : G.emerald, marginTop: 10 }}>{simMsg}</p>}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {editInterval && vault && (
        <EditIntervalModal
          current={vault.intervalDays} grace={vault.gracePeriodDays}
          onSave={saveInterval} onClose={() => setEditInterval(false)} loading={saving}
        />
      )}
      {editBens && vault && (
        <EditBeneficiariesModal
          initialRows={initialBenRows}
          onSave={saveBeneficiaries} onClose={() => setEditBens(false)} loading={saving}
        />
      )}
    </div>
  );
}
