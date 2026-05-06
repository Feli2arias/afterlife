"use client";
import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, registerVault, fetchVaultConfig, BeneficiaryInput } from "@/lib/vigil";
import { getUserTokenAccounts, wrapAndApproveSOL, approveDelegateForToken } from "@/lib/delegate";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Users, Activity, CheckCircle, ChevronRight, SkipForward, Plus, ArrowRight } from "lucide-react";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", padding: "2px 4px", lineHeight: 1, fontSize: 13 }}
      >ⓘ</button>
      {show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,10,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", width: 220, zIndex: 50, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(16px)", fontFamily: SF }}>
          {text}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  {
    id: "welcome",
    title: "The Final Protocol",
    description: "Afterlife is a decentralized inheritance protocol. Before you launch your vault, we need to configure your end-of-life directives.",
    popupText: "Welcome to Afterlife. This tutorial will guide you through setting up your digital inheritance layer.",
  },
  {
    id: "beneficiaries",
    title: "Designate Heirs",
    description: "Who receives your assets when the protocol is triggered?",
    popupText: "Add the wallet addresses of your heirs. You can configure exact percentage allocations for each beneficiary.",
  },
  {
    id: "proof_of_life",
    title: "Proof of Life",
    description: "How often will you confirm you are still here?",
    popupText: "Set your check-in interval. If you fail to ping within this time frame, your heirs will be able to claim the assets.",
  },
  {
    id: "deploy",
    title: "Deploy Protocol",
    description: "Review your directives before locking them into the smart contract.",
    popupText: "Double-check your settings. Deploying will write these rules directly to the blockchain. Network fees apply.",
  },
];

const STEP_BG = [
  "radial-gradient(ellipse at center, rgba(30,30,30,0.8) 0%, #030303 100%)",
  "radial-gradient(ellipse at top, rgba(30,58,138,0.15) 0%, #030303 80%)",
  "radial-gradient(ellipse at top, rgba(20,83,45,0.15) 0%, #030303 80%)",
  "radial-gradient(ellipse at center, rgba(88,28,135,0.15) 0%, #030303 80%)",
];

export default function SetupPage() {
  return <Suspense><SetupContent /></Suspense>;
}

function SetupContent() {
  const { publicKey, signTransaction } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";

  // step 0 = wallet connect, 1-4 = onboarding steps
  const [step, setStep] = useState(isDemo ? 1 : 0);
  const [rows, setRows] = useState([{ wallet: "", share: 100 }]);
  const [intervalDays, setIntervalDays] = useState(30);
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [tokenInfos, setTokenInfos] = useState<Awaited<ReturnType<typeof getUserTokenAccounts>>>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(true);

  // 0-indexed for STEPS array: step 1 → STEPS[0], step 2 → STEPS[1], etc.
  const stepIdx = Math.max(0, step - 1);
  const currentStepData = STEPS[Math.min(stepIdx, STEPS.length - 1)];

  useEffect(() => {
    if (isDemo) return;
    if (!publicKey || !wallet || step !== 0) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    fetchVaultConfig(program, publicKey).then(existing => {
      if (existing) { router.push("/dashboard"); return; }
      setStep(1);
    });
  }, [publicKey, wallet]); // eslint-disable-line

  useEffect(() => {
    if (step !== 3 || !publicKey) return;
    getUserTokenAccounts(connection, publicKey).then(setTokenInfos);
  }, [step, publicKey]); // eslint-disable-line

  useEffect(() => {
    setShowPopup(true);
  }, [step]);

  const totalShare = rows.reduce((s, r) => s + Number(r.share || 0), 0);

  function validateBeneficiaries(): BeneficiaryInput[] | null {
    if (rows.length === 0) { setError("Add at least one beneficiary"); return null; }
    if (Math.abs(totalShare - 100) > 0.01) { setError("Percentages must add up to exactly 100%"); return null; }
    const result: BeneficiaryInput[] = [];
    for (const row of rows) {
      try { result.push({ wallet: new PublicKey(row.wallet.trim()), shareBps: Math.round(row.share * 100) }); }
      catch { setError(`Invalid wallet: ${row.wallet.slice(0, 20)}...`); return null; }
    }
    return result;
  }

  async function handleApprove(token: typeof tokenInfos[0]) {
    if (!publicKey || !signTransaction) return;
    const key = token.mint.toBase58();
    setApproving(key); setError("");
    try {
      if (token.isNativeSol) {
        await wrapAndApproveSOL(connection, publicKey, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      } else {
        await approveDelegateForToken(connection, publicKey, token.mint, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      }
      setApproved(prev => new Set([...prev, key]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally { setApproving(null); }
  }

  async function handleDeploy() {
    if (isDemo) { router.push("/dashboard?demo=1"); return; }
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
      setError(e instanceof Error ? e.message : "Error registering vault");
      setDeploying(false);
    }
  }

  function goNext() {
    setError("");
    if (step === 1) {
      const v = validateBeneficiaries();
      if (!v && !isDemo) return;
    }
    if (step < 4) setStep(step + 1);
    else handleDeploy();
  }

  function goBack() {
    setError("");
    if (step > 1) setStep(step - 1);
    else router.push("/");
  }

  // Step 0: wallet connect screen (pre-onboarding)
  if (step === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#030303", color: "white", fontFamily: SF, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(30,30,30,0.6) 0%, #030303 70%)" }} />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 28px", borderRadius: 22, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck className="w-8 h-8 text-white/30" />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Welcome to Afterlife</h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 40, maxWidth: 340, margin: "0 auto 40px" }}>
            Your crypto legacy, secured on-chain. Connect your wallet to begin.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <WalletMultiButton style={{ width: "100%", maxWidth: 300, justifyContent: "center", borderRadius: 999, padding: "14px 24px", fontSize: 15, fontWeight: 600 }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Phantom, Solflare & more · Devnet</p>
          </div>
        </div>
      </div>
    );
  }

  // Steps 1-4: OnboardingView design
  return (
    <div style={{ minHeight: "100vh", background: "#030303", color: "white", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column", fontFamily: SF }}>
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />

      {/* Dynamic background per step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${step}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{ position: "absolute", inset: 0, zIndex: 0, background: STEP_BG[stepIdx] || STEP_BG[0] }}
        />
      </AnimatePresence>

      {/* Back nav */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={goBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, fontFamily: SF, display: "flex", alignItems: "center", gap: 6, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Afterlife
        </button>
        <span style={{ fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em" }}>
          {stepIdx + 1} / {STEPS.length}
        </span>
      </div>

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "100px 28px 40px", display: "flex", flexDirection: "column" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {/* Step header */}
            <div style={{ marginBottom: 48, maxWidth: 680 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", display: "block", marginBottom: 16 }}>
                Stage 0{stepIdx + 1}
              </span>
              <h1 style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 20 }}>
                {currentStepData.title}
              </h1>
              <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 560 }}>
                {currentStepData.description}
              </p>
            </div>

            {/* Step interactive area */}
            <div style={{ flex: 1 }}>

              {/* Step 1: Designate Heirs */}
              {step === 1 && (
                <div style={{ width: "100%", maxWidth: 700, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", padding: "32px 36px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700 }}>Heirs List</h3>
                    <button
                      onClick={() => rows.length < 5 && setRows(prev => [...prev, { wallet: "", share: 0 }])}
                      disabled={rows.length >= 5}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, background: rows.length >= 5 ? "rgba(255,255,255,0.1)" : "white", color: rows.length >= 5 ? "rgba(255,255,255,0.3)" : "black", padding: "8px 16px", borderRadius: 99, border: "none", cursor: rows.length >= 5 ? "default" : "pointer", fontWeight: 600, fontFamily: SF }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Address
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rows.map((row, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6, fontFamily: SF }}>
                            Wallet Address (Solana)
                            <Tooltip text="The beneficiary's public Solana address." />
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 7aXP...9b2C"
                            value={row.wallet}
                            onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, wallet: e.target.value } : r))}
                            style={{ width: "100%", background: "transparent", border: "none", color: "white", fontSize: 14, fontFamily: MONO, outline: "none" }}
                          />
                        </div>
                        <div style={{ flexShrink: 0, width: 100 }}>
                          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6, fontFamily: SF }}>Share (%)</label>
                          <input
                            type="number" min={1} max={100}
                            value={row.share}
                            onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))}
                            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 10px", color: "white", textAlign: "center", fontSize: 13, fontFamily: SF, outline: "none" }}
                          />
                        </div>
                        {rows.length > 1 && (
                          <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 16, gap: 8 }}>
                    <div style={{ height: 3, width: 60, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(totalShare, 100)}%`, background: Math.abs(totalShare - 100) < 0.01 ? "rgba(255,255,255,0.6)" : totalShare > 100 ? "#ef4444" : "#f59e0b", borderRadius: 99, transition: "width 0.3s, background 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: Math.abs(totalShare - 100) < 0.01 ? "rgba(255,255,255,0.7)" : "#ef4444" }}>{totalShare}%</span>
                  </div>
                  {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 12 }}>{error}</p>}
                </div>
              )}

              {/* Step 2: Proof of Life (interval) */}
              {step === 2 && (
                <div style={{ width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", padding: "32px 36px" }}>
                  <Activity className="w-10 h-10 text-white/30 mb-8" />
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Select Interval</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                    {[
                      { days: 7, label: "7 Days" },
                      { days: 30, label: "30 Days" },
                      { days: 90, label: "90 Days" },
                      { days: 365, label: "365 Days" },
                    ].map(opt => (
                      <button key={opt.days} onClick={() => setIntervalDays(opt.days)}
                        style={{ padding: "20px", borderRadius: 18, border: `1px solid ${intervalDays === opt.days ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)"}`, background: intervalDays === opt.days ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.3)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: intervalDays === opt.days ? "white" : "rgba(255,255,255,0.4)", fontFamily: SF, display: "block" }}>{opt.label}</span>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 6, fontFamily: SF }}>Interval</p>
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: SF }}>Grace period</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: SF }}>{gracePeriodDays === 0 ? "None" : `+${gracePeriodDays} days`}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[0, 3, 7, 14].map(d => (
                        <button key={d} onClick={() => setGracePeriodDays(d)}
                          style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${gracePeriodDays === d ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.07)"}`, background: gracePeriodDays === d ? "rgba(255,255,255,0.08)" : "transparent", color: gracePeriodDays === d ? "white" : "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: SF, transition: "all 0.15s" }}>
                          {d === 0 ? "None" : `+${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Authorize */}
              {step === 3 && (
                <div style={{ width: "100%", maxWidth: 700, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", padding: "32px 36px" }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Authorize Assets</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.6, fontFamily: SF }}>
                    Your funds stay in your wallet. You only give Afterlife permission to move them if the timer expires.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tokenInfos.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14, fontFamily: SF }}>Loading assets...</div>
                    )}
                    {tokenInfos.map(token => {
                      const key = token.mint.toBase58();
                      const isApproved = approved.has(key);
                      const isApprovingThis = approving === key;
                      const display = token.isNativeSol
                        ? `${(Number(token.balance) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                        : `${(Number(token.balance) / 10 ** token.decimals).toFixed(2)} ${token.symbol}`;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", border: `1px solid ${isApproved ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`, borderRadius: 18, background: "rgba(0,0,0,0.3)", transition: "all 0.2s" }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, fontFamily: SF }}>{token.symbol}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: SF }}>{display}</div>
                          </div>
                          <button
                            onClick={() => !isApproved && handleApprove(token)}
                            disabled={isApproved || !!isApprovingThis}
                            style={{ padding: "9px 20px", borderRadius: 99, border: "none", cursor: isApproved ? "default" : "pointer", background: isApproved ? "rgba(255,255,255,0.08)" : "white", color: isApproved ? "rgba(255,255,255,0.4)" : "black", fontSize: 13, fontWeight: 600, transition: "all 0.2s", fontFamily: SF, opacity: isApprovingThis ? 0.6 : 1 }}
                          >
                            {isApprovingThis ? "Signing..." : isApproved ? "✓ Done" : "Authorize"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 16 }}>{error}</p>}
                </div>
              )}

              {/* Step 4: Deploy Protocol */}
              {step === 4 && (
                <div style={{ width: "100%", maxWidth: 800, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
                    <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 24 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontFamily: SF }}>Total Heirs</p>
                        <p style={{ fontSize: 28, fontWeight: 800, fontFamily: SF }}>{rows.length} Address{rows.length !== 1 ? "es" : ""}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontFamily: SF }}>Ping Requirement</p>
                        <p style={{ fontSize: 28, fontWeight: 800, color: "#4ade80", fontFamily: SF }}>Every {intervalDays} Days</p>
                      </div>
                      {gracePeriodDays > 0 && (
                        <div>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontFamily: SF }}>Grace Period</p>
                          <p style={{ fontSize: 28, fontWeight: 800, fontFamily: SF }}>+{gracePeriodDays} Days</p>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 240, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20, padding: "28px" }}>
                      <CheckCircle className="w-7 h-7 text-white/30 mb-5" />
                      <h4 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12, fontFamily: SF }}>Ready for Deployment</h4>
                      <p style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 28, fontSize: 14, fontFamily: SF }}>
                        Once deployed, your rules are locked into the smart contract. Network fees will apply.
                      </p>
                      <button onClick={handleDeploy} disabled={deploying}
                        style={{ width: "100%", padding: "15px", borderRadius: 99, background: deploying ? "rgba(255,255,255,0.25)" : "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: deploying ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: SF, transition: "all 0.2s" }}
                      >
                        {deploying && <div style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "black", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                        {deploying ? "Deploying..." : "Deploy Protocol"} {!deploying && <ArrowRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {error && <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

            </div>

            {/* Bottom nav (steps 1-3) */}
            {step < 4 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 40, gap: 12 }}>
                <button onClick={goNext}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 99, background: "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: SF, transition: "all 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(230,230,230,1)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  {step === 3 ? "Review" : "Next"} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tutorial popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.4 }}
            style={{ position: "fixed", bottom: 28, right: 28, zIndex: 50, width: 340, background: "rgb(79,70,229)", borderRadius: 24, padding: "20px 22px", boxShadow: "0 20px 60px -15px rgba(79,70,229,0.5)", border: "1px solid rgba(165,180,252,0.25)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.18)", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "white", fontFamily: SF }}>
                Tutorial {stepIdx + 1}/{STEPS.length}
              </div>
              <button onClick={() => setShowPopup(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 4 }}>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <p style={{ color: "white", fontSize: 15, fontWeight: 500, lineHeight: 1.55, marginBottom: 20, fontFamily: SF }}>
              {currentStepData.popupText}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setShowPopup(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: SF }}>
                Skip Tutorial
              </button>
              <button onClick={goNext}
                style={{ background: "white", color: "rgb(79,70,229)", padding: "9px 20px", borderRadius: 99, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: SF }}
              >
                {step === 4 ? "Finish" : "Next"} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
