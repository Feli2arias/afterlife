"use client";
import { useState, useEffect, useCallback } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, registerVault, fetchVaultConfig, BeneficiaryInput } from "@/lib/vigil";
import { getUserTokenAccounts, wrapAndApproveSOL, approveDelegateForToken } from "@/lib/delegate";
import { useRouter } from "next/navigation";

// ─── Style tokens ──────────────────────────────────────────────────────────
const G = {
  bg: "#030303",
  glass: "rgba(200,200,200,0.04)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderHover: "rgba(255,255,255,0.2)",
  emerald: "#10b981",
  emeraldDim: "rgba(16,185,129,0.1)",
  emeraldBorder: "rgba(16,185,129,0.2)",
  text: "#ffffff",
  textMuted: "#a1a1aa",
  textDim: "#52525b",
  inputBg: "rgba(255,255,255,0.03)",
  inputBorder: "rgba(255,255,255,0.08)",
  inputFocus: "rgba(255,255,255,0.25)",
  danger: "#ef4444",
};

// ─── Tooltip ───────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{ background: "none", border: "none", cursor: "pointer", color: G.textDim, padding: "2px 4px", lineHeight: 1, fontSize: 13 }}
      >
        ⓘ
      </button>
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "rgba(20,20,20,0.97)", border: `1px solid ${G.glassBorder}`,
          borderRadius: 10, padding: "10px 14px", width: 220, zIndex: 50,
          fontSize: 12, color: G.textMuted, lineHeight: 1.6,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
        }}>
          {text}
          <div style={{ position: "absolute", bottom: -5, left: "50%", width: 8, height: 8, background: "rgba(20,20,20,0.97)", border: `1px solid ${G.glassBorder}`, borderTop: "none", borderLeft: "none", transform: "translateX(-50%) rotate(45deg)" }} />
        </div>
      )}
    </div>
  );
}

// ─── Progress dots ─────────────────────────────────────────────────────────
const STEP_LABELS = ["Wallet", "Beneficiarios", "Check-in", "Autorizar", "Revisar"];

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 36 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: i === current ? 32 : 28, height: i === current ? 32 : 28,
              borderRadius: "50%",
              background: i < current ? G.emerald : i === current ? G.emeraldDim : "rgba(255,255,255,0.04)",
              border: `2px solid ${i <= current ? G.emerald : G.glassBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.3s ease",
              fontSize: 11, fontWeight: 700,
              color: i < current ? "white" : i === current ? G.emerald : G.textDim,
            }}>
              {i < current ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (i + 1)}
            </div>
            <span style={{ fontSize: 10, color: i === current ? G.emerald : G.textDim, transition: "color 0.3s", fontWeight: i === current ? 600 : 400, whiteSpace: "nowrap" }}>
              {STEP_LABELS[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div style={{ width: 32, height: 2, background: i < current ? G.emerald : G.glassBorder, marginBottom: 20, transition: "background 0.3s ease", marginLeft: 2, marginRight: 2 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step wrapper ──────────────────────────────────────────────────────────
function StepCard({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 0.25s ease, transform 0.25s ease",
    }}>
      {children}
    </div>
  );
}

// ─── Hint box ─────────────────────────────────────────────────────────────
function Hint({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.55, margin: 0 }}>{children}</p>
    </div>
  );
}

// ─── Input styles ─────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: G.inputBg, border: `1px solid ${G.inputBorder}`,
  borderRadius: 12, padding: "12px 16px",
  fontSize: 14, color: G.text, fontFamily: "inherit",
  outline: "none", transition: "border-color 0.2s",
};

const monoInputStyle: React.CSSProperties = {
  ...inputStyle, fontFamily: "monospace", fontSize: 13,
};

// ─── Main ─────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const { publicKey, signTransaction } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Form state
  const [rows, setRows] = useState([{ wallet: "", share: 100 }]);
  const [intervalDays, setIntervalDays] = useState(30);
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [tokenInfos, setTokenInfos] = useState<Awaited<ReturnType<typeof getUserTokenAccounts>>>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [fieldFocus, setFieldFocus] = useState<string | null>(null);

  // Auto-advance from step 0 when wallet connects, or redirect if vault exists
  useEffect(() => {
    if (!publicKey || !wallet) return;
    if (step !== 0) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    fetchVaultConfig(program, publicKey).then(existing => {
      if (existing) { router.push("/dashboard"); return; }
      transition(1);
    });
  }, [publicKey, wallet]); // eslint-disable-line

  // Load tokens when reaching authorize step
  useEffect(() => {
    if (step !== 3 || !publicKey) return;
    getUserTokenAccounts(connection, publicKey).then(setTokenInfos);
  }, [step, publicKey]); // eslint-disable-line

  function transition(next: number) {
    setVisible(false);
    setTimeout(() => { setStep(next); setVisible(true); setError(""); }, 220);
  }

  // Beneficiaries validation
  const totalShare = rows.reduce((s, r) => s + Number(r.share || 0), 0);
  function validateBeneficiaries(): BeneficiaryInput[] | null {
    if (rows.length === 0) { setError("Agregá al menos un beneficiario"); return null; }
    if (Math.abs(totalShare - 100) > 0.01) { setError("Los porcentajes deben sumar exactamente 100%"); return null; }
    const result: BeneficiaryInput[] = [];
    for (const row of rows) {
      try { result.push({ wallet: new PublicKey(row.wallet.trim()), shareBps: Math.round(row.share * 100) }); }
      catch { setError(`Wallet inválida: ${row.wallet.slice(0, 20)}...`); return null; }
    }
    return result;
  }

  async function handleApprove(token: typeof tokenInfos[0]) {
    if (!publicKey || !signTransaction) return;
    const key = token.mint.toBase58();
    setApproving(key);
    setError("");
    try {
      if (token.isNativeSol) {
        await wrapAndApproveSOL(connection, publicKey, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      } else {
        await approveDelegateForToken(connection, publicKey, token.mint, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      }
      setApproved(prev => new Set([...prev, key]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "La transacción falló");
    } finally { setApproving(null); }
  }

  async function handleDeploy() {
    if (!publicKey || !wallet) return;
    setDeploying(true); setError("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      const bens = validateBeneficiaries();
      if (!bens) { setDeploying(false); return; }
      await registerVault(program, publicKey, bens, intervalDays, gracePeriodDays);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar el vault");
      setDeploying(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>

      {/* Noise */}
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Ambient blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 65%)", top: "-20%", left: "-15%", animation: "blob1 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.015) 0%, transparent 65%)", bottom: "-10%", right: "-5%", animation: "blob2 22s ease-in-out infinite" }} />
      </div>

      <style>{`
        @keyframes blob1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
        @keyframes blob2{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}}
        input:focus{border-color:rgba(255,255,255,0.25)!important;box-shadow:0 0 0 3px rgba(255,255,255,0.05)}
        input[type=number]::-webkit-inner-spin-button{opacity:0.5}
        .tok-btn:hover{border-color:rgba(255,255,255,0.2)!important;background:rgba(255,255,255,0.04)!important}
      `}</style>

      {/* Back link */}
      <div style={{ position: "fixed", top: 20, left: 24, zIndex: 10 }}>
        <a href="/" style={{ color: G.textDim, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = G.text)}
          onMouseLeave={e => (e.currentTarget.style.color = G.textDim)}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Vigil
        </a>
      </div>

      {/* Card */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>

        {/* Step 0: Connect */}
        {step === 0 && (
          <StepCard visible={visible}>
            <div className="liquid-glass" style={{ borderRadius: 28, padding: "48px 40px", textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <img src="/logo.png" alt="Vigil" style={{ width: 36, height: 36, objectFit: "contain" }} />
              </div>

              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>Bienvenido a Vigil</h1>
              <p style={{ fontSize: 15, color: G.textMuted, lineHeight: 1.65, marginBottom: 36, maxWidth: 380, margin: "0 auto 36px" }}>
                Tu herencia crypto, asegurada on-chain. Configurá en 3 minutos quién recibe tus activos si algo te pasa.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <WalletMultiButton style={{ width: "100%", maxWidth: 320, justifyContent: "center", borderRadius: 999, padding: "14px 24px", fontSize: 15, fontWeight: 600 }} />
                <p style={{ fontSize: 12, color: G.textDim }}>Phantom, Solflare, y más · Devnet</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 40, paddingTop: 32, borderTop: `1px solid ${G.glassBorder}` }}>
                {[
                  { icon: "🔐", t: "No-custodial", s: "Tus llaves, siempre" },
                  { icon: "⚡", t: "2 minutos", s: "Setup rápido" },
                  { icon: "🌐", t: "On-chain", s: "Sin intermediarios" },
                ].map(({ icon, t, s }) => (
                  <div key={t} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: G.text }}>{t}</div>
                    <div style={{ fontSize: 11, color: G.textDim, marginTop: 2 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </StepCard>
        )}

        {/* Steps 1–4 */}
        {step >= 1 && (
          <StepCard visible={visible}>
            <div className="liquid-glass" style={{ borderRadius: 28, padding: "40px 36px" }}>

              <ProgressDots current={step - 1} total={4} />

              {/* ── Step 1: Beneficiaries ── */}
              {step === 1 && (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>¿Quién recibe tus activos?</h2>
                    <p style={{ fontSize: 14, color: G.textMuted, lineHeight: 1.6 }}>Ingresá la wallet de cada persona y el porcentaje que le corresponde.</p>
                  </div>

                  <Hint icon="💡">
                    Los beneficiarios son las personas que recibirán tus criptos si el timer expira. Podés agregar hasta 5, con cualquier distribución porcentual.
                  </Hint>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                    {rows.map((row, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          {i === 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <label style={{ fontSize: 11, color: G.textDim, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wallet</label>
                              <Tooltip text="Dirección pública de Solana del beneficiario. La persona que quieras que reciba tus fondos." />
                            </div>
                          )}
                          <input
                            placeholder={`Beneficiario ${i + 1} — dirección de wallet`}
                            value={row.wallet}
                            onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, wallet: e.target.value } : r))}
                            onFocus={() => setFieldFocus(`w${i}`)}
                            onBlur={() => setFieldFocus(null)}
                            style={{ ...monoInputStyle, borderColor: fieldFocus === `w${i}` ? G.inputFocus : G.inputBorder }}
                          />
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {i === 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <label style={{ fontSize: 11, color: G.textDim, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>%</label>
                              <Tooltip text="Porcentaje del total que recibirá este beneficiario. Todos deben sumar 100%." />
                            </div>
                          )}
                          <input
                            type="number" min={1} max={100}
                            value={row.share}
                            onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))}
                            onFocus={() => setFieldFocus(`s${i}`)}
                            onBlur={() => setFieldFocus(null)}
                            style={{ ...inputStyle, width: 72, textAlign: "center", borderColor: fieldFocus === `s${i}` ? G.inputFocus : G.inputBorder }}
                          />
                        </div>
                        {rows.length > 1 && (
                          <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: "none", border: "none", color: G.textDim, cursor: "pointer", fontSize: 18, padding: "0 4px", marginTop: i === 0 ? 22 : 0, flexShrink: 0, transition: "color 0.2s" }}
                            onMouseEnter={e => (e.currentTarget.style.color = G.danger)}
                            onMouseLeave={e => (e.currentTarget.style.color = G.textDim)}
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <button
                      onClick={() => rows.length < 5 && setRows(prev => [...prev, { wallet: "", share: 0 }])}
                      disabled={rows.length >= 5}
                      style={{ background: "none", border: "none", color: rows.length >= 5 ? G.textDim : G.emerald, cursor: rows.length >= 5 ? "default" : "pointer", fontSize: 13, fontWeight: 500, padding: 0, transition: "opacity 0.2s", opacity: rows.length >= 5 ? 0.4 : 1 }}
                    >+ Agregar beneficiario</button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 4, width: 80, background: G.glassBorder, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(totalShare, 100)}%`, background: Math.abs(totalShare - 100) < 0.01 ? G.emerald : totalShare > 100 ? G.danger : "#f59e0b", borderRadius: 99, transition: "width 0.3s, background 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: Math.abs(totalShare - 100) < 0.01 ? G.emerald : G.danger }}>{totalShare}%</span>
                    </div>
                  </div>

                  {error && <p style={{ fontSize: 13, color: G.danger, marginBottom: 16 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => transition(0)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "transparent", border: `1px solid ${G.glassBorder}`, color: G.textMuted, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = G.glassBorder)}
                    >← Atrás</button>
                    <button onClick={() => { const v = validateBeneficiaries(); if (v) transition(2); }}
                      style={{ flex: 2, padding: "13px", borderRadius: 14, background: G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                      onMouseLeave={e => (e.currentTarget.style.background = G.emerald)}
                    >Continuar →</button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Interval ── */}
              {step === 2 && (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>¿Con qué frecuencia confirmás?</h2>
                    <p style={{ fontSize: 14, color: G.textMuted, lineHeight: 1.6 }}>Si no hacés check-in antes de que venza el plazo, Vigil distribuirá tus activos.</p>
                  </div>

                  <Hint icon="⏱">
                    Este es tu <strong style={{ color: "#d1fae5" }}>dead man's switch</strong>. Cada período debés confirmar que seguís vivo con un clic. Si no lo hacés, tus beneficiarios reciben todo.
                  </Hint>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
                    {[
                      { days: 30, label: "30 días", sub: "Mensual", rec: false },
                      { days: 60, label: "60 días", sub: "Bimestral", rec: true },
                      { days: 90, label: "90 días", sub: "Trimestral", rec: false },
                    ].map(opt => (
                      <button key={opt.days} onClick={() => setIntervalDays(opt.days)}
                        style={{
                          padding: "18px 12px", borderRadius: 16, border: `2px solid ${intervalDays === opt.days ? G.emerald : G.glassBorder}`,
                          background: intervalDays === opt.days ? G.emeraldDim : "rgba(255,255,255,0.02)",
                          color: intervalDays === opt.days ? G.text : G.textMuted,
                          cursor: "pointer", transition: "all 0.2s", position: "relative", textAlign: "center",
                        }}>
                        {opt.rec && <div style={{ position: "absolute", top: -8, right: -8, background: G.emerald, color: "white", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99 }}>REC</div>}
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{opt.sub}</div>
                      </button>
                    ))}
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${G.glassBorder}`, borderRadius: 16, padding: "18px 20px", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, color: G.text, fontWeight: 500 }}>Período de gracia</span>
                      <Tooltip text="Tiempo extra después del deadline donde todavía podés hacer check-in de emergencia. Ideal si vas de viaje sin internet." />
                      <span style={{ marginLeft: "auto", fontSize: 13, color: G.emerald, fontWeight: 600 }}>
                        {gracePeriodDays === 0 ? "Sin gracia" : `+${gracePeriodDays} días`}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: G.textDim, marginBottom: 12, lineHeight: 1.5 }}>Margen extra antes de activar la distribución.</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[0, 3, 7, 14].map(d => (
                        <button key={d} onClick={() => setGracePeriodDays(d)}
                          style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${gracePeriodDays === d ? G.emerald : G.glassBorder}`, background: gracePeriodDays === d ? G.emeraldDim : "transparent", color: gracePeriodDays === d ? G.emerald : G.textDim, fontSize: 12, cursor: "pointer", fontWeight: gracePeriodDays === d ? 700 : 400, transition: "all 0.2s" }}>
                          {d === 0 ? "Ninguno" : `${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p style={{ fontSize: 13, color: G.danger, marginBottom: 16 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => transition(1)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "transparent", border: `1px solid ${G.glassBorder}`, color: G.textMuted, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = G.glassBorder)}
                    >← Atrás</button>
                    <button onClick={() => transition(3)}
                      style={{ flex: 2, padding: "13px", borderRadius: 14, background: G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                      onMouseLeave={e => (e.currentTarget.style.background = G.emerald)}
                    >Continuar →</button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Authorize ── */}
              {step === 3 && (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Autorizá tus activos</h2>
                    <p style={{ fontSize: 14, color: G.textMuted, lineHeight: 1.6 }}>Tus fondos <strong style={{ color: G.text }}>siguen en tu wallet</strong>. Solo le das permiso a Vigil de moverlos <em>si el timer vence</em>.</p>
                  </div>

                  <Hint icon="🔐">
                    Esto <strong style={{ color: "#d1fae5" }}>no deposita</strong> nada. Es una aprobación SPL delegate: Vigil puede distribuir tus activos únicamente cuando el plazo expire. Podés revocar en cualquier momento.
                  </Hint>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                    {tokenInfos.length === 0 && (
                      <div style={{ padding: "24px", textAlign: "center", color: G.textDim, fontSize: 14 }}>Cargando activos...</div>
                    )}
                    {tokenInfos.map(token => {
                      const key = token.mint.toBase58();
                      const isApproved = approved.has(key);
                      const isApproving = approving === key;
                      const display = token.isNativeSol
                        ? `${(Number(token.balance) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                        : `${(Number(token.balance) / 10 ** token.decimals).toFixed(2)} ${token.symbol}`;
                      return (
                        <div key={key} className="tok-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: `1px solid ${isApproved ? G.emeraldBorder : G.glassBorder}`, borderRadius: 14, transition: "all 0.2s", cursor: "default" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{token.symbol}</span>
                              {token.isNativeSol && (
                                <span style={{ fontSize: 10, color: G.textDim, background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 99 }}>se convierte a wSOL</span>
                              )}
                              <Tooltip text={token.isNativeSol ? "Tu SOL se envuelve como wSOL (1:1). Es reversible y necesario para que Vigil pueda distribuirlo como token SPL." : "Vigil recibirá permiso de distribuir este token si el timer vence. Tus fondos nunca se mueven ahora."} />
                            </div>
                            <span style={{ fontSize: 12, color: G.textDim }}>{display}</span>
                          </div>
                          <button
                            onClick={() => !isApproved && handleApprove(token)}
                            disabled={isApproved || !!isApproving}
                            style={{ padding: "8px 18px", borderRadius: 10, border: "none", cursor: isApproved ? "default" : "pointer", background: isApproved ? "rgba(16,185,129,0.15)" : G.emerald, color: isApproved ? G.emerald : "white", fontSize: 13, fontWeight: 600, transition: "all 0.2s", opacity: isApproving ? 0.6 : 1 }}
                          >
                            {isApproving ? "Firmando..." : isApproved ? "✓ Listo" : "Autorizar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {error && <p style={{ fontSize: 13, color: G.danger, marginBottom: 16 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => transition(2)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "transparent", border: `1px solid ${G.glassBorder}`, color: G.textMuted, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = G.glassBorder)}
                    >← Atrás</button>
                    <button onClick={() => transition(4)}
                      style={{ flex: 2, padding: "13px", borderRadius: 14, background: approved.size > 0 ? G.emerald : "rgba(255,255,255,0.06)", color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => approved.size > 0 && (e.currentTarget.style.background = "#059669")}
                      onMouseLeave={e => approved.size > 0 && (e.currentTarget.style.background = G.emerald)}
                    >
                      {approved.size > 0 ? "Continuar →" : "Saltar por ahora →"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 4: Review ── */}
              {step === 4 && (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Revisá tu configuración</h2>
                    <p style={{ fontSize: 14, color: G.textMuted, lineHeight: 1.6 }}>Todo listo para deployar tu vault en Solana. Revisá los datos antes de firmar.</p>
                  </div>

                  {/* Summary */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                    {/* Beneficiaries */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${G.glassBorder}`, borderRadius: 16, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Beneficiarios</div>
                      {rows.map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < rows.length - 1 ? 8 : 0 }}>
                          <span style={{ fontSize: 12, color: G.textMuted, fontFamily: "monospace" }}>{r.wallet.slice(0, 10)}...{r.wallet.slice(-6)}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: G.emerald }}>{r.share}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Interval */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${G.glassBorder}`, borderRadius: 16, padding: "16px 18px", display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 11, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Check-in</div>
                        <span style={{ fontSize: 14, color: G.text, fontWeight: 600 }}>Cada {intervalDays} días</span>
                      </div>
                      {gracePeriodDays > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Gracia</div>
                          <span style={{ fontSize: 14, color: G.text, fontWeight: 600 }}>+{gracePeriodDays} días</span>
                        </div>
                      )}
                    </div>

                    {/* Assets */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${G.glassBorder}`, borderRadius: 16, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: G.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Activos autorizados</div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: approved.size > 0 ? G.emerald : G.textDim }}>{approved.size > 0 ? `${approved.size} activo${approved.size > 1 ? "s" : ""}` : "Ninguno aún"}</span>
                    </div>

                    {/* Fee notice */}
                    <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 12 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                      <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5, margin: 0 }}>
                        Cada check-in cuesta 0.005 SOL. La creación del vault requiere una pequeña renta de cuenta (~0.002 SOL).
                      </p>
                    </div>
                  </div>

                  {error && <p style={{ fontSize: 13, color: G.danger, marginBottom: 16 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => transition(3)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "transparent", border: `1px solid ${G.glassBorder}`, color: G.textMuted, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = G.glassBorder)}
                    >← Atrás</button>
                    <button onClick={handleDeploy} disabled={deploying}
                      style={{ flex: 2, padding: "13px", borderRadius: 14, background: deploying ? "rgba(16,185,129,0.5)" : G.emerald, color: "white", fontSize: 14, fontWeight: 700, border: "none", cursor: deploying ? "default" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      onMouseEnter={e => !deploying && (e.currentTarget.style.background = "#059669")}
                      onMouseLeave={e => !deploying && (e.currentTarget.style.background = G.emerald)}
                    >
                      {deploying && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                      {deploying ? "Desplegando..." : "🚀 Lanzar mi Vigil"}
                    </button>
                  </div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}
