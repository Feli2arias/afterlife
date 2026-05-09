"use client";
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, NATIVE_MINT, getAccount } from "@solana/spl-token";
import { getProgram, fetchVaultConfig } from "@/lib/vigil";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useCreateWallet, useExportWallet } from "@privy-io/react-auth/solana";
import PrivyClaimProvider from "@/components/PrivyClaimProvider";

interface VaultData {
  owner: { toBase58: () => string };
  beneficiaries: Array<{ emailHash: number[]; shareBps: number }>;
  isActive: boolean;
  intervalDays: number;
  lastCheckin: { toNumber: () => number };
  executedTotal: { toNumber: () => number };
}

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif";
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

const DEMO_VAULT: VaultData = {
  owner: { toBase58: () => "Demo1111111111111111111111111111111111111111" },
  beneficiaries: [{ emailHash: new Array(32).fill(0), shareBps: 5000 }],
  isActive: false,
  intervalDays: 60,
  lastCheckin: { toNumber: () => Math.floor(Date.now() / 1000) - 70 * 86400 },
  executedTotal: { toNumber: () => 2_100_000_000 }, // 2.1 SOL demo
};

type Screen = "landing" | "choice" | "has-wallet" | "no-wallet" | "claiming-phantom" | "claiming-privy" | "claimed";
type WalletPath = "phantom" | "privy";

// ── Bridge: calls usePrivy() only when inside a live PrivyProvider ─────────────

function ClaimWithPrivy({ params }: { params: Promise<{ owner: string }> }) {
  const { login, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const privyWalletAddress = wallets[0]?.address ?? null;

  // Fallback: if logged in but createOnLogin didn't fire, create wallet manually
  useEffect(() => {
    if (!authenticated || privyWalletAddress || creatingWallet) return;
    setCreatingWallet(true);
    setWalletError(null);
    createWallet()
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        // "already has wallet" is not a real error — Privy just beat us to it
        if (!msg.toLowerCase().includes("already")) setWalletError(msg);
      })
      .finally(() => setCreatingWallet(false));
  }, [authenticated, privyWalletAddress, creatingWallet, createWallet]);

  return (
    <Suspense>
      <ClaimContent
        params={params}
        privyLogin={login}
        privyLogout={logout}
        privyAuthenticated={authenticated && !!privyWalletAddress}
        privyEmail={user?.email?.address ?? null}
        privyWalletAddress={privyWalletAddress}
        privyCreatingWallet={authenticated && !privyWalletAddress && !walletError}
        privyWalletError={walletError}
        privyExportWallet={exportWallet}
      />
    </Suspense>
  );
}

// ── Entry point ────────────────────────────────────────────────────────────────

export default function ClaimInner({ params }: { params: Promise<{ owner: string }> }) {
  const [privyError, setPrivyError] = useState<string | null>(null);

  // If Privy crashed, render the no-wallet path with a visible error
  if (privyError) {
    return (
      <Suspense>
        <ClaimContent
          params={params}
          privyLogin={() => alert(`Wallet service unavailable: ${privyError}`)}
          privyLogout={async () => {}}
          privyAuthenticated={false}
          privyEmail={null}
          privyWalletAddress={null}
          privyCreatingWallet={false}
          privyWalletError={privyError}
        />
      </Suspense>
    );
  }

  return (
    <PrivyClaimProvider onCrash={setPrivyError}>
      <ClaimWithPrivy params={params} />
    </PrivyClaimProvider>
  );
}

// ── Main content ───────────────────────────────────────────────────────────────

interface ClaimContentProps {
  params: Promise<{ owner: string }>;
  privyLogin: () => void;
  privyLogout: () => void | Promise<void>;
  privyAuthenticated: boolean;
  privyEmail: string | null;
  privyWalletAddress: string | null;
  privyCreatingWallet?: boolean;
  privyWalletError?: string | null;
  privyExportWallet?: () => Promise<void>;
}

function ClaimContent({
  params,
  privyLogin,
  privyLogout,
  privyAuthenticated,
  privyEmail,
  privyWalletAddress,
  privyCreatingWallet,
  privyWalletError,
  privyExportWallet,
}: ClaimContentProps) {
  const { owner: ownerParam } = use(params);
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1" || ownerParam === "DEMO";

  // Solana wallet adapter (Phantom)
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const [vault, setVault] = useState<VaultData | null>(isDemo ? DEMO_VAULT : null);
  const [loading, setLoading] = useState(!isDemo);
  const [ownerWsol, setOwnerWsol] = useState<number>(isDemo ? 2.1 : 0);
  const [claiming, setClaiming] = useState(false);
  const [screen, setScreen] = useState<Screen>("landing");
  const [walletPath, setWalletPath] = useState<WalletPath>("phantom");

  useEffect(() => {
    if (isDemo) return;
    async function load() {
      try {
        const ownerPk = new PublicKey(ownerParam);
        // Read owner's wSOL ATA — this is the delegated amount
        try {
          const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, ownerPk);
          const wsolAcc = await getAccount(connection, wsolAta);
          setOwnerWsol(Number(wsolAcc.amount) / LAMPORTS_PER_SOL);
        } catch { /* owner has no wSOL ATA yet */ }
        if (!wallet) return;
        const provider = new AnchorProvider(connection, wallet, {});
        const program = getProgram(provider);
        const data = await fetchVaultConfig(program, ownerPk);
        if (data) setVault(data as VaultData);
      } catch { /* invalid address */ }
      finally { setLoading(false); }
    }
    load();
  }, [ownerParam, wallet, connection, isDemo]);

  // Auto-advance when Phantom wallet connects
  useEffect(() => {
    if (publicKey && screen === "has-wallet") setScreen("claiming-phantom");
  }, [publicKey, screen]);

  // Auto-advance when Privy user logs in
  useEffect(() => {
    if (privyAuthenticated && screen === "no-wallet") setScreen("claiming-privy");
  }, [privyAuthenticated, screen]);

  const [claimError, setClaimError] = useState<string | null>(null);
  const [phantomEmail, setPhantomEmail] = useState("");

  const heirIdxRaw = parseInt(searchParams.get("heir") ?? "0", 10);
  const heirIdx = Number.isFinite(heirIdxRaw) && heirIdxRaw >= 0 ? heirIdxRaw : 0;
  const displayShare = vault?.beneficiaries[heirIdx]?.shareBps ?? 0;

  // After execution tokens are in vault — use executedTotal. Before, show owner's wSOL.
  const executedTotal = vault?.executedTotal?.toNumber?.() ?? 0;
  const claimableAmount = vault && !vault.isActive && executedTotal > 0
    ? executedTotal * displayShare / 10_000
    : ownerWsol * displayShare / 10_000 * LAMPORTS_PER_SOL;
  const displaySol = (claimableAmount / LAMPORTS_PER_SOL).toFixed(3);

  async function executeClaim(heirAddress: string, heirEmail: string) {
    if (!heirEmail.trim()) {
      setClaimError("Please enter your email address to claim");
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerAddress: ownerParam,
          heirAddress,
          heirEmail: heirEmail.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid response" }));
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setScreen("claimed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setClaimError(msg);
      console.error("[claim]", msg);
    } finally {
      setClaiming(false);
    }
  }

  async function claimWithPhantom() {
    if (!publicKey) return;
    await executeClaim(publicKey.toBase58(), phantomEmail);
  }

  async function claimWithPrivy() {
    if (!privyWalletAddress || !privyEmail) return;
    await executeClaim(privyWalletAddress, privyEmail);
  }

  const activeAddress = walletPath === "privy"
    ? privyWalletAddress
    : publicKey?.toBase58();

  return (
    <div style={{ minHeight: "100vh", background: "#030303", color: "#fff", fontFamily: SF, position: "relative", overflowX: "hidden" }}>
      <div className="bg-noise" style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none", mixBlendMode: "overlay" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ width: 48, height: 48, margin: "0 auto", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/logo.png" alt="Vigil" style={{ width: 28, height: 28, objectFit: "contain" }} />
            </div>
          </div>

          <AnimatePresence mode="wait">

            {/* ── LANDING ──────────────────────────────────────────────── */}
            {screen === "landing" && (
              <motion.div key="landing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                  <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontFamily: MONO }}>
                    VIGIL · Decentralized Inheritance
                  </p>
                  <h1 style={{ margin: "0 0 16px", fontSize: 38, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.15, color: "rgba(255,255,255,0.92)" }}>
                    You have an<br />inheritance waiting.
                  </h1>
                  <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
                    Someone designated you as a beneficiary of their digital assets. The protocol has been activated and your share is ready to claim.
                  </p>
                </div>

                {/* Amount card */}
                {!loading && vault && (
                  <div style={{ borderRadius: 20, padding: "28px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", marginBottom: 24 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>Your share</p>
                    <p style={{ margin: "0 0 4px", fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em", color: "white", lineHeight: 1 }}>
                      {displaySol}
                    </p>
                    <p style={{ margin: "0 0 20px", fontSize: 16, color: "rgba(255,255,255,0.3)" }}>SOL</p>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "6px 14px" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: MONO }}>Ready to claim</span>
                    </div>
                  </div>
                )}

                {loading && <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.15)", fontSize: 13 }}>Loading vault...</div>}

                <button
                  onClick={() => setScreen("choice")}
                  style={{ width: "100%", padding: "16px", borderRadius: 16, background: "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: SF }}
                >
                  Claim your inheritance →
                </button>

                <p style={{ textAlign: "center", margin: "16px 0 0", fontSize: 12, color: "rgba(255,255,255,0.15)", lineHeight: 1.6 }}>
                  Secured by the Vigil smart contract on Solana.<br />No lawyers. No banks. No waiting.
                </p>
              </motion.div>
            )}

            {/* ── CHOICE ───────────────────────────────────────────────── */}
            {screen === "choice" && (
              <motion.div key="choice" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}>
                <div style={{ textAlign: "center", marginBottom: 36 }}>
                  <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Do you have a crypto wallet?</h2>
                  <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                    A wallet is your digital identity on the blockchain — like a bank account only you control.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    onClick={() => { setWalletPath("phantom"); setScreen("has-wallet"); }}
                    style={{ width: "100%", padding: "20px 24px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", textAlign: "left", fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  >
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Yes, I have Phantom / Solflare</p>
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Connect your existing wallet</p>
                    </div>
                    <span style={{ fontSize: 20, opacity: 0.4 }}>→</span>
                  </button>

                  <button
                    onClick={() => { setWalletPath("privy"); setScreen("no-wallet"); }}
                    style={{ width: "100%", padding: "20px 24px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", textAlign: "left", fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  >
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>No, I'm new to crypto</p>
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Create a wallet with your email — takes 30 seconds</p>
                    </div>
                    <span style={{ fontSize: 20, opacity: 0.4 }}>→</span>
                  </button>
                </div>

                <button onClick={() => setScreen("landing")} style={{ display: "block", margin: "20px auto 0", background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 13, cursor: "pointer", fontFamily: SF }}>← Back</button>
              </motion.div>
            )}

            {/* ── HAS WALLET (Phantom) ─────────────────────────────────── */}
            {screen === "has-wallet" && (
              <motion.div key="has-wallet" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Connect your wallet</h2>
                  <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>Connect Phantom or Solflare to verify and claim.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 24px", borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 40 }}>🔗</div>
                  <WalletMultiButton style={{ borderRadius: 14, fontSize: 14 }} />
                </div>
                <button onClick={() => setScreen("choice")} style={{ display: "block", margin: "20px auto 0", background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 13, cursor: "pointer", fontFamily: SF }}>← Back</button>
              </motion.div>
            )}

            {/* ── NO WALLET → Privy login ──────────────────────────────── */}
            {screen === "no-wallet" && (
              <motion.div key="no-wallet" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Create your wallet</h2>
                  <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                    Sign in with your email or Google and we'll create a secure crypto wallet for you — instantly, no downloads needed.
                  </p>
                </div>

                <div style={{ borderRadius: 20, padding: "32px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 20, marginBottom: 16 }}>
                  {[
                    { icon: "✉️", text: "Sign in with email or Google" },
                    { icon: "🔐", text: "Your wallet is created automatically" },
                    { icon: "◎",  text: "Claim your SOL right here" },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {s.icon}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{s.text}</p>
                    </div>
                  ))}

                  {privyWalletError && (
                    <p style={{ textAlign: "center", fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "10px 14px", fontFamily: SF }}>
                      Wallet creation failed: {privyWalletError}. Please try again or use Phantom.
                    </p>
                  )}

                  {privyCreatingWallet ? (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: SF }}>
                      <div style={{ marginBottom: 8 }}>Creating your wallet...</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>This takes a few seconds</div>
                    </div>
                  ) : (
                    <button
                      onClick={privyLogin}
                      style={{ width: "100%", padding: "16px", borderRadius: 14, background: "white", color: "black", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: SF, marginTop: 8 }}
                    >
                      Continue with email →
                    </button>
                  )}
                </div>

                <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)", lineHeight: 1.6, margin: 0 }}>
                  Your wallet is non-custodial. Only you control your funds.
                </p>

                <button onClick={() => setScreen("choice")} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 13, cursor: "pointer", fontFamily: SF }}>← Back</button>
              </motion.div>
            )}

            {/* ── CLAIMING (Phantom) ───────────────────────────────────── */}
            {screen === "claiming-phantom" && (
              <ClaimCard
                address={publicKey?.toBase58() ?? ""}
                displaySol={displaySol}
                displayShare={displayShare}
                ownerParam={ownerParam}
                claiming={claiming}
                error={claimError}
                onClaim={claimWithPhantom}
                onDisconnect={() => setScreen("choice")}
                walletLabel="Phantom"
                emailInput={phantomEmail}
                onEmailChange={setPhantomEmail}
              />
            )}

            {/* ── CLAIMING (Privy) ─────────────────────────────────────── */}
            {screen === "claiming-privy" && (
              <ClaimCard
                address={privyWalletAddress ?? ""}
                displaySol={displaySol}
                displayShare={displayShare}
                ownerParam={ownerParam}
                claiming={claiming}
                error={claimError}
                onClaim={claimWithPrivy}
                onDisconnect={() => { privyLogout(); setScreen("choice"); }}
                walletLabel="Email wallet"
                privyEmail={privyEmail ?? undefined}
              />
            )}

            {/* ── CLAIMED ──────────────────────────────────────────────── */}
            {screen === "claimed" && (
              <ClaimedScreen
                amount={displaySol}
                address={activeAddress ?? ""}
                walletPath={walletPath}
                privyEmail={privyEmail ?? undefined}
                onExportWallet={privyExportWallet}
              />
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Claimed screen ─────────────────────────────────────────────────────────────

function ClaimedScreen({ amount, address, walletPath, privyEmail, onExportWallet }: {
  amount: string;
  address: string;
  walletPath: WalletPath;
  privyEmail?: string;
  onExportWallet?: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const solscanUrl = `https://solscan.io/account/${address}?cluster=devnet`;

  function copy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div key="claimed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 180 }}
          style={{ width: 88, height: 88, borderRadius: 28, background: "rgba(74,222,128,0.1)", border: "1.5px solid rgba(74,222,128,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 42 }}
        >
          ✓
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "white" }}>
            It&apos;s yours.
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
            The inheritance has been transferred successfully.<br />
            The funds are now in your digital wallet.
          </p>
        </motion.div>
      </div>

      {/* ── Amount ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        style={{ borderRadius: 20, padding: "28px 24px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", textAlign: "center", marginBottom: 16 }}
      >
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(74,222,128,0.5)" }}>Received</p>
        <p style={{ margin: 0, fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", color: "white", lineHeight: 1 }}>
          {amount}
          <span style={{ fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>SOL</span>
        </p>
      </motion.div>

      {/* ── Wallet address ── */}
      {address && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          style={{ borderRadius: 16, padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontFamily: SF }}>Your wallet address</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: MONO, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</span>
            <button
              onClick={copy}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`, color: copied ? "#4ade80" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: SF, transition: "all 0.2s" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Next steps ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        style={{ borderRadius: 20, padding: "24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}
      >
        <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontFamily: SF }}>What&apos;s next?</p>

        {walletPath === "privy" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <NextStep
              num="1"
              title="Your funds are safe"
              desc="The SOL is secured in your new wallet. You control it — nobody else can touch it."
            />

            {/* Export wallet — the key action for new crypto users */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 1 }}>2</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: SF }}>Get your wallet key to use it anywhere</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, fontFamily: SF }}>
                  Your wallet has a secret key — like a password that proves it&apos;s yours. Export it now and import it into Phantom to access your funds from any device.
                </p>
                {onExportWallet ? (
                  <button
                    onClick={() => onExportWallet()}
                    style={{ padding: "10px 20px", borderRadius: 12, background: "white", color: "black", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: SF }}
                  >
                    Show my wallet key →
                  </button>
                ) : (
                  <a href="https://phantom.com/download" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: SF, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                    Download Phantom →
                  </a>
                )}
              </div>
            </div>

            <NextStep
              num="3"
              title="Check your balance anytime"
              desc="You can verify your funds are there right now — no app needed."
              link={{ label: "View on Solscan →", href: solscanUrl }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <NextStep
              num="1"
              title="Open Phantom"
              desc="Your SOL is already in your Phantom wallet. Open the app and you'll see your updated balance."
            />
            <NextStep
              num="2"
              title="Check the transaction"
              desc="You can verify the transfer on the blockchain — it's a public, permanent record."
              link={{ label: "View on Solscan →", href: solscanUrl }}
            />
          </div>
        )}
      </motion.div>

      <p style={{ textAlign: "center", margin: 0, fontSize: 11, color: "rgba(255,255,255,0.1)", lineHeight: 1.7, fontFamily: MONO }}>
        Vigil · Decentralized Inheritance on Solana
      </p>
    </motion.div>
  );
}

function NextStep({ num, title, desc, link }: { num: string; title: string; desc: string; link?: { label: string; href: string } }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 1 }}>
        {num}
      </div>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: SF }}>{title}</p>
        <p style={{ margin: link ? "0 0 8px" : 0, fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, fontFamily: SF }}>{desc}</p>
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: SF, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          >
            {link.label}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Shared claim card ──────────────────────────────────────────────────────────

function ClaimCard({
  address, displaySol, displayShare,
  ownerParam, claiming, error, onClaim, onDisconnect, walletLabel, privyEmail,
  emailInput, onEmailChange,
}: {
  address: string;
  displaySol: string;
  displayShare: number;
  ownerParam: string;
  claiming: boolean;
  error: string | null;
  onClaim: () => void;
  onDisconnect: () => void;
  walletLabel: string;
  privyEmail?: string;
  emailInput?: string;
  onEmailChange?: (v: string) => void;
}) {
  return (
    <motion.div key="claiming" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>✓</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", fontFamily: SF }}>Wallet connected</h2>
        {privyEmail && (
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: SF }}>{privyEmail}</p>
        )}
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: MONO }}>
          {address.slice(0, 6)}...{address.slice(-4)} · {walletLabel}
        </p>
      </div>

      <div style={{ borderRadius: 20, padding: "24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", fontFamily: SF }}>Available to claim</p>
            <p style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: "white", fontFamily: SF }}>
              {displaySol}
              <span style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 6 }}>SOL</span>
            </p>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>◎</div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          <Row label="Your share" value={`${displayShare / 100}%`} />
          <Row label="Network" value="Solana Devnet" mono />
          <Row label="Contract" value={`${ownerParam.slice(0, 6)}...${ownerParam.slice(-4)}`} mono />
        </div>

        {/* Email input — Phantom users must provide email to match on-chain hash */}
        {onEmailChange !== undefined && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8, fontFamily: SF }}>
              Your email address
            </label>
            <input
              type="email"
              placeholder="email@example.com"
              value={emailInput ?? ""}
              onChange={e => onEmailChange(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, fontFamily: SF, outline: "none", boxSizing: "border-box" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: SF }}>
              Must match the email your benefactor used when setting up Vigil
            </p>
          </div>
        )}

        {error && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontFamily: SF }}>
            {error}
          </p>
        )}

        <button
          onClick={onClaim}
          disabled={claiming}
          style={{ width: "100%", padding: "16px", borderRadius: 14, background: claiming ? "rgba(255,255,255,0.2)" : "white", color: claiming ? "rgba(0,0,0,0.4)" : "black", fontSize: 15, fontWeight: 700, border: "none", cursor: claiming ? "default" : "pointer", fontFamily: SF, transition: "all 0.2s" }}
        >
          {claiming ? "Processing on Solana..." : "Claim your assets →"}
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)", lineHeight: 1.6, margin: "0 0 8px", fontFamily: SF }}>
        No gas needed — transaction signed by Vigil protocol
      </p>
      <div style={{ textAlign: "center" }}>
        <button onClick={onDisconnect} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", fontSize: 12, cursor: "pointer", fontFamily: SF }}>
          Use a different wallet
        </button>
      </div>
    </motion.div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: SF }}>{label}</span>
      <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: mono ? MONO : SF }}>{value}</span>
    </div>
  );
}
