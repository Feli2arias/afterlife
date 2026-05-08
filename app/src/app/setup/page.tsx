"use client";
import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, registerVault, cancelVault, fetchVaultConfig, BeneficiaryInput } from "@/lib/vigil";
import { getUserTokenAccounts, wrapAndApproveSOL, approveDelegateForToken } from "@/lib/delegate";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronRight, ChevronLeft, Info, Check, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

// ─── Contextual hint card ─────────────────────────────────────────────────────

function HintCard({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-4 rounded-2xl border border-white/8 bg-white/[0.03] mb-6"
    >
      <Info className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-white/40 leading-relaxed flex-1" style={{ fontFamily: SF }}>{text}</p>
      <button onClick={onDismiss} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0 mt-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const labels = ["Beneficiaries", "Life Check", "Contact", "Review"];
  return (
    <div className="mb-12">
      <div className="flex items-center gap-0 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 flex-shrink-0 ${
              i < current ? "bg-white text-black" : i === current ? "border-2 border-white text-white bg-transparent" : "border border-white/15 text-white/25"
            }`} style={{ fontFamily: SF }}>
              {i < current ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < total - 1 && (
              <div className="flex-1 h-px mx-2" style={{ background: i < current ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-white/25 tracking-widest uppercase" style={{ fontFamily: SF }}>
        Step {current + 1} of {total} — {labels[current]}
      </p>
    </div>
  );
}

// ─── Validation message ───────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-red-400 mt-2" style={{ fontFamily: SF }}>
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // 0 = wallet connect gate, 1-4 = onboarding steps
  const [phase, setPhase] = useState(isDemo ? 1 : 0);

  // Step 1: beneficiaries
  const [rows, setRows] = useState([{ email: "", name: "", share: 100 }]);
  const [rowErrors, setRowErrors] = useState<string[]>([]);

  // Step 2: life check interval
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [intervalError, setIntervalError] = useState("");

  // Step 3: contact
  const [email, setEmail] = useState("");
  const [backupEmail, setBackupEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Step 4: authorize + deploy
  const [tokenInfos, setTokenInfos] = useState<Awaited<ReturnType<typeof getUserTokenAccounts>>>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");

  // Hint visibility
  const [hints, setHints] = useState({ step1: true, step2: true, step3: true });

  // no auto-advance — user clicks Continue explicitly

  useEffect(() => {
    if (phase === 4 && publicKey) {
      getUserTokenAccounts(connection, publicKey).then(setTokenInfos);
    }
  }, [phase, publicKey]); // eslint-disable-line

  const effectiveInterval = intervalDays ?? (customDays ? parseInt(customDays) : 0);
  const totalShare = rows.reduce((s, r) => s + Number(r.share || 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  // ── Validation ───────────────────────────────────────────────────────────────

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateStep1(): boolean {
    const errs: string[] = rows.map(() => "");
    let ok = true;

    if (!isDemo) {
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].email.trim()) {
          errs[i] = "Email address is required";
          ok = false;
        } else if (!EMAIL_RE.test(rows[i].email.trim())) {
          errs[i] = "Enter a valid email (e.g. name@example.com)";
          ok = false;
        }
      }
    }

    if (Math.abs(totalShare - 100) > 0.01) {
      errs[errs.length - 1] = (errs[errs.length - 1] ? errs[errs.length - 1] + " · " : "") + "Percentages must total exactly 100%";
      ok = false;
    }

    setRowErrors(errs);
    return ok;
  }

  function validateStep2(): boolean {
    if (!effectiveInterval || effectiveInterval < 1) {
      setIntervalError("Please select or enter an interval");
      return false;
    }
    if (effectiveInterval > 365) {
      setIntervalError("Maximum interval is 365 days");
      return false;
    }
    setIntervalError("");
    return true;
  }

  function validateStep3(): boolean {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }

  function next() {
    if (phase === 1 && !validateStep1()) return;
    if (phase === 2 && !validateStep2()) return;
    if (phase === 3 && !validateStep3()) return;
    setPhase(p => p + 1);
  }

  function back() {
    if (phase > 1) setPhase(p => p - 1);
  }

  // ── Authorize ────────────────────────────────────────────────────────────────

  async function handleApprove(token: typeof tokenInfos[0]) {
    if (!publicKey || !signTransaction) return;
    const key = token.mint.toBase58();
    setApproving(key);
    try {
      if (token.isNativeSol) {
        await wrapAndApproveSOL(connection, publicKey, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      } else {
        await approveDelegateForToken(connection, publicKey, token.mint, token.balance, signTransaction as (tx: Transaction) => Promise<Transaction>);
      }
      setApproved(prev => new Set([...prev, key]));
    } catch (e) {
      console.error(e);
    } finally { setApproving(null); }
  }

  // ── Deploy ───────────────────────────────────────────────────────────────────

  async function handleDeploy() {
    if (isDemo) { router.push("/dashboard?demo=1"); return; }
    if (!publicKey || !wallet) return;
    setDeploying(true); setDeployError("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      const existing = await fetchVaultConfig(program, publicKey);
      if (existing) await cancelVault(program, publicKey);
      const bens: BeneficiaryInput[] = rows.map(r => ({
        wallet: publicKey, // email-based — real wallet resolution TBD
        shareBps: Math.round(r.share * 100),
      }));
      await registerVault(program, publicKey, bens, effectiveInterval, gracePeriodDays);
      sessionStorage.setItem(
        `afterlife_heirs_${publicKey.toBase58()}`,
        JSON.stringify(rows.map(r => ({ email: r.email.trim(), name: r.name.trim(), share: r.share })))
      );
      router.push("/dashboard");
    } catch (e: unknown) {
      setDeployError(e instanceof Error ? e.message : "Deployment failed. Please try again.");
      setDeploying(false);
    }
  }

  // ── Step 0: Wallet connect ────────────────────────────────────────────────────

  if (phase === 0) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center px-6" style={{ fontFamily: SF }}>
        <div className="bg-noise fixed inset-0 z-[100] pointer-events-none mix-blend-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_65%)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm text-center"
        >
          <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white/40" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
            Protect Your Legacy
          </h1>
          <p className="text-white/40 text-sm leading-relaxed mb-10 max-w-xs mx-auto">
            Connect your wallet to begin setting up your inheritance plan. It takes less than 3 minutes.
          </p>

          <WalletMultiButton style={{ width: "100%", justifyContent: "center", borderRadius: 14, padding: "14px 24px", fontSize: 15, fontWeight: 600 }} />

          <p className="text-white/20 text-xs mt-4">Phantom, Solflare &amp; other Solana wallets · Devnet</p>

          {publicKey && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex flex-col items-center gap-3"
            >
              <p className="text-xs text-white/30 font-mono" style={{ fontFamily: MONO }}>
                ✓ Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}
              </p>
              <button
                onClick={() => setPhase(1)}
                className="flex items-center gap-2 bg-white text-black text-sm font-bold px-6 py-3 rounded-full hover:bg-white/90 transition-all"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-3 gap-4">
            {[
              { icon: "🔐", label: "Non-custodial" },
              { icon: "⚡", label: "3 min setup" },
              { icon: "🌐", label: "On-chain" },
            ].map(({ icon, label }) => (
              <div key={label} className="text-center">
                <div className="text-lg mb-1.5">{icon}</div>
                <div className="text-xs text-white/25">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Steps 1-4 ────────────────────────────────────────────────────────────────

  const STEP_BG = [
    "",
    "radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.06) 0%, transparent 60%)",
    "radial-gradient(ellipse at 70% 30%, rgba(16,185,129,0.06) 0%, transparent 60%)",
    "radial-gradient(ellipse at 50% 20%, rgba(168,85,247,0.06) 0%, transparent 60%)",
    "radial-gradient(ellipse at 40% 20%, rgba(245,158,11,0.05) 0%, transparent 60%)",
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white" style={{ fontFamily: SF }}>
      <div className="bg-noise fixed inset-0 z-[100] pointer-events-none mix-blend-overlay" />

      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${phase}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 pointer-events-none"
          style={{ background: STEP_BG[phase] || "" }}
        />
      </AnimatePresence>

      {/* Back link */}
      <div className="fixed top-0 left-0 right-0 z-30 px-6 pt-6 flex items-center justify-between">
        <button
          onClick={phase === 1 ? () => router.push("/") : back}
          className="flex items-center gap-2 text-white/25 hover:text-white/60 transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          {phase === 1 ? "Home" : "Back"}
        </button>
        <span className="text-xs text-white/20 font-mono" style={{ fontFamily: MONO }}>
          Afterlife
        </span>
      </div>

      <div className="min-h-screen flex items-start justify-center pt-24 pb-20 px-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <StepBar current={phase - 1} total={4} />

              {/* ── STEP 1: Beneficiaries ─────────────────────────────────── */}
              {phase === 1 && (
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
                    Who inherits your legacy?
                  </h1>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Add the people who will receive your assets. You can assign custom percentages to each person.
                  </p>

                  <AnimatePresence>
                    {hints.step1 && (
                      <HintCard
                        text="Enter each heir's email address. You can add up to 5 recipients and split the inheritance any way you like — the total must equal 100%."
                        onDismiss={() => setHints(h => ({ ...h, step1: false }))}
                      />
                    )}
                  </AnimatePresence>

                  <div className="space-y-3 mb-5">
                    {rows.map((row, i) => (
                      <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-white/30 font-mono uppercase tracking-widest" style={{ fontFamily: MONO }}>
                            Heir {i + 1}
                          </span>
                          {rows.length > 1 && (
                            <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-white/50 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex gap-3 items-start">
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-white/30 mb-1.5 block">Email Address</label>
                            <input
                              type="email"
                              placeholder="heir@example.com"
                              value={row.email}
                              onChange={e => {
                                setRows(prev => prev.map((r, idx) => idx === i ? { ...r, email: e.target.value } : r));
                                if (rowErrors[i]) setRowErrors(prev => prev.map((err, idx) => idx === i ? "" : err));
                              }}
                              className={`w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 focus:outline-none transition-colors ${rowErrors[i] ? "border-red-500/40 focus:border-red-500/60" : "border-white/8 focus:border-white/25"}`}
                            />
                          </div>
                          <div className="w-20 flex-shrink-0">
                            <label className="text-xs text-white/30 mb-1.5 block">Share</label>
                            <div className="relative">
                              <input
                                type="number" min={1} max={100}
                                value={row.share}
                                onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, share: Number(e.target.value) } : r))}
                                className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-3 text-sm text-white text-center focus:outline-none focus:border-white/25 transition-colors"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/25">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="text-xs text-white/30 mb-1.5 block">Name <span className="text-white/15">(optional)</span></label>
                          <input
                            type="text"
                            placeholder="e.g. Mom, Sarah, Brother"
                            value={row.name}
                            onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/15 focus:outline-none focus:border-white/25 transition-colors"
                          />
                        </div>

                        {rowErrors[i] && <FieldError msg={rowErrors[i]} />}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mb-8">
                    <button
                      onClick={() => rows.length < 5 && setRows(prev => [...prev, { email: "", name: "", share: 0 }])}
                      disabled={rows.length >= 5}
                      className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-default"
                    >
                      <Plus className="w-4 h-4" /> Add another heir
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 rounded-full overflow-hidden bg-white/8">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(totalShare, 100)}%`,
                            background: Math.abs(totalShare - 100) < 0.01 ? "rgba(255,255,255,0.6)" : totalShare > 100 ? "#ef4444" : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${Math.abs(totalShare - 100) < 0.01 ? "text-white/70" : "text-amber-400"}`}>
                        {totalShare}%
                      </span>
                    </div>
                  </div>

                  <NavButtons onNext={next} />
                </div>
              )}

              {/* ── STEP 2: Life Check Interval ───────────────────────────── */}
              {phase === 2 && (
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
                    How often will you check in?
                  </h1>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Set your Activity Confirmation interval. If we don't receive a signal within this period, your Continuity Plan will activate.
                  </p>

                  <AnimatePresence>
                    {hints.step2 && (
                      <HintCard
                        text="You'll confirm your activity with a single tap before this deadline. Choose a comfortable interval — you can always adjust it later."
                        onDismiss={() => setHints(h => ({ ...h, step2: false }))}
                      />
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                      { days: 30, label: "30 days", sub: "Monthly" },
                      { days: 90, label: "90 days", sub: "Quarterly", rec: true },
                      { days: 180, label: "6 months", sub: "Biannual" },
                      { days: 365, label: "1 year", sub: "Annual" },
                    ].map(opt => (
                      <button
                        key={opt.days}
                        onClick={() => { setIntervalDays(opt.days); setIntervalError(""); }}
                        className={`relative p-5 rounded-2xl border text-left transition-all ${
                          intervalDays === opt.days
                            ? "border-white/40 bg-white/[0.06]"
                            : "border-white/8 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        {opt.rec && (
                          <span className="absolute -top-2 -right-2 text-[10px] font-bold tracking-widest uppercase bg-white text-black px-2 py-0.5 rounded-full">Rec.</span>
                        )}
                        <div className="text-base font-bold text-white mb-1">{opt.label}</div>
                        <div className="text-xs text-white/30 uppercase tracking-widest">{opt.sub}</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom interval */}
                  <div className="mb-6">
                    <label className="text-xs text-white/30 mb-2 block uppercase tracking-widest">Custom interval (days)</label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="number" min={1} max={365}
                        placeholder="e.g. 60"
                        value={customDays}
                        onChange={e => { setCustomDays(e.target.value); setIntervalDays(null); setIntervalError(""); }}
                        onFocus={() => setIntervalDays(null)}
                        className="w-36 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                      />
                      <span className="text-sm text-white/30">days</span>
                    </div>
                  </div>

                  {/* Grace period */}
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white/70 mb-0.5">Grace period</div>
                        <div className="text-xs text-white/25">Extra buffer before your Continuity Plan activates</div>
                      </div>
                      <span className="text-sm font-semibold text-white/60">{gracePeriodDays === 0 ? "None" : `+${gracePeriodDays} days`}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {[0, 3, 7, 14].map(d => (
                        <button key={d} onClick={() => setGracePeriodDays(d)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${gracePeriodDays === d ? "border-white/30 bg-white/[0.07] text-white" : "border-white/8 text-white/30 hover:border-white/15 hover:text-white/50"}`}>
                          {d === 0 ? "None" : `+${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {intervalError && <FieldError msg={intervalError} />}

                  <NavButtons onNext={next} />
                </div>
              )}

              {/* ── STEP 3: Contact & Recovery ────────────────────────────── */}
              {phase === 3 && (
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
                    Stay informed
                  </h1>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Add your contact details so we can send reminders before your Activity Confirmation deadline.
                  </p>

                  <AnimatePresence>
                    {hints.step3 && (
                      <HintCard
                        text="You'll receive reminder emails before your Life Check deadline so you never miss a confirmation. This information is optional but recommended."
                        onDismiss={() => setHints(h => ({ ...h, step3: false }))}
                      />
                    )}
                  </AnimatePresence>

                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="text-xs text-white/30 mb-2 block uppercase tracking-widest">Email address <span className="text-white/15">(recommended)</span></label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                      />
                      {emailError && <FieldError msg={emailError} />}
                      <p className="text-xs text-white/20 mt-2">Used only for Life Check reminders. Never shared.</p>
                    </div>

                    <div>
                      <label className="text-xs text-white/30 mb-2 block uppercase tracking-widest">Backup email <span className="text-white/15">(optional)</span></label>
                      <input
                        type="email"
                        placeholder="backup@email.com"
                        value={backupEmail}
                        onChange={e => setBackupEmail(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-4 mb-8">
                    <p className="text-xs text-white/25 leading-relaxed">
                      📬 Email notifications are coming soon. Your contact details will be stored securely and used exclusively for Activity Confirmation reminders.
                    </p>
                  </div>

                  <NavButtons onNext={next} skipLabel="Skip for now" onSkip={() => setPhase(4)} />
                </div>
              )}

              {/* ── STEP 4: Final Review ───────────────────────────────────── */}
              {phase === 4 && (
                <div>
                  <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
                    Your Continuity Plan
                  </h1>
                  <p className="text-white/40 mb-8 leading-relaxed">
                    Review your Legacy Protection setup before activating it on-chain.
                  </p>

                  {/* Summary cards */}
                  <div className="space-y-3 mb-6">

                    {/* Heirs */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-white/30 uppercase tracking-widest">Legacy Recipients</span>
                        <button onClick={() => setPhase(1)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Edit</button>
                      </div>
                      <div className="space-y-2">
                        {rows.map((r, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-white/60">
                                {r.email || `Heir ${i + 1}`}
                              </span>
                              {r.name && <span className="ml-2 text-xs text-white/25">{r.name}</span>}
                            </div>
                            <span className="text-sm font-bold text-white/80">{r.share}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Interval */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/30 uppercase tracking-widest">Activity Confirmation</span>
                        <button onClick={() => setPhase(2)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Edit</button>
                      </div>
                      <div className="flex items-baseline gap-3 mt-2">
                        <span className="text-2xl font-bold text-white">Every {effectiveInterval} days</span>
                        {gracePeriodDays > 0 && <span className="text-sm text-white/30">+{gracePeriodDays}d grace</span>}
                      </div>
                    </div>

                    {/* Contact */}
                    {(email || backupEmail) && (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-white/30 uppercase tracking-widest">Reminder Contact</span>
                          <button onClick={() => setPhase(3)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Edit</button>
                        </div>
                        {email && <p className="text-sm text-white/60">{email}</p>}
                        {backupEmail && <p className="text-sm text-white/30 mt-1">{backupEmail} <span className="text-xs text-white/15">backup</span></p>}
                      </div>
                    )}

                    {/* Authorize assets — only show when there are actual funds */}
                    {!isDemo && tokenInfos.some(t => Number(t.balance) > 0) && (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                        <div className="mb-4">
                          <span className="text-xs text-white/30 uppercase tracking-widest block mb-1">Secure Transfer Authorization</span>
                          <p className="text-xs text-white/25 leading-relaxed">
                            Authorize Afterlife to transfer these assets only when your Continuity Plan activates. Your assets stay in your wallet until then.
                          </p>
                        </div>
                        <div className="space-y-2">
                          {tokenInfos.map(token => {
                            const key = token.mint.toBase58();
                            const isApproved = approved.has(key);
                            const isApprovingThis = approving === key;
                            const display = token.isNativeSol
                              ? `${(Number(token.balance) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                              : `${(Number(token.balance) / 10 ** token.decimals).toFixed(2)} ${token.symbol}`;
                            return (
                              <div key={key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div>
                                  <span className="text-sm font-medium text-white/70">{token.symbol}</span>
                                  <span className="text-xs text-white/25 ml-2">{display}</span>
                                </div>
                                <button
                                  onClick={() => !isApproved && handleApprove(token)}
                                  disabled={isApproved || !!isApprovingThis}
                                  className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-all ${isApproved ? "bg-white/[0.05] text-white/30 cursor-default" : "bg-white text-black hover:bg-white/90"}`}
                                >
                                  {isApprovingThis ? "Signing..." : isApproved ? "✓ Authorized" : "Authorize"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Network fee note */}
                  <div className="flex gap-3 p-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] mb-8">
                    <span className="text-sm">⚡</span>
                    <p className="text-xs text-amber-400/60 leading-relaxed">
                      Activating your Legacy Protection requires a small Solana network fee (~0.002 SOL for account creation, 0.005 SOL per Life Check).
                    </p>
                  </div>

                  {deployError && (
                    <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/[0.05]">
                      <p className="text-sm text-red-400">{deployError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-black text-base font-bold tracking-tight transition-all hover:bg-white/90 disabled:opacity-50 disabled:cursor-default"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {deploying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        Activate Legacy Protection
                      </>
                    )}
                  </button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom nav buttons ───────────────────────────────────────────────────────

function NavButtons({ onNext, skipLabel, onSkip }: { onNext: () => void; skipLabel?: string; onSkip?: () => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onSkip && skipLabel ? (
        <button onClick={onSkip} className="text-sm text-white/25 hover:text-white/50 transition-colors" style={{ fontFamily: SF }}>
          {skipLabel}
        </button>
      ) : (
        <div />
      )}
      <button
        onClick={onNext}
        className="flex items-center gap-2 bg-white text-black text-sm font-bold px-6 py-3 rounded-full hover:bg-white/90 transition-all"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
