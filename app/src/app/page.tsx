"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useRouter } from "next/navigation";
import { getProgram, fetchVaultConfig } from "@/lib/vigil";

// ─── Liquid Glass token ───────────────────────────────────────────────────
const LG = {
  surface: `
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%);
    backdrop-filter: blur(48px) saturate(180%) brightness(1.04);
    -webkit-backdrop-filter: blur(48px) saturate(180%) brightness(1.04);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow:
      inset 0 1.5px 0 0 rgba(255,255,255,0.22),
      inset 0 -1px 0 0 rgba(0,0,0,0.18),
      inset 1px 0 0 0 rgba(255,255,255,0.08),
      inset -1px 0 0 0 rgba(0,0,0,0.06),
      0 40px 100px rgba(0,0,0,0.45),
      0 0 0 0.5px rgba(255,255,255,0.07);
  `,
};

// ─── Spring intersection ──────────────────────────────────────────────────
function useSpringIn(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"hidden" | "in">("hidden");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setState("in"); },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, state };
}

function SpringIn({
  children, delay = 0, y = 32, className = "",
}: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const { ref, state } = useSpringIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: state === "in" ? 1 : 0,
        transform: state === "in" ? "translateY(0) scale(1)" : `translateY(${y}px) scale(0.98)`,
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Vigil logo ───────────────────────────────────────────────────────────
function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M4 16 L10 10 L16 20 L22 6 L28 16" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="16" r="3" fill="#10b981" />
    </svg>
  );
}

// ─── Hero glass card ──────────────────────────────────────────────────────
function HeroCard({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const days = 23, hrs = tick % 24, mins = tick % 60;

  return (
    <div
      ref={cardRef}
      style={{
        width: "100%", maxWidth: 360,
        borderRadius: 28, padding: "28px",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(145deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.07) 100%)",
        backdropFilter: "blur(60px) saturate(200%) brightness(1.06)",
        WebkitBackdropFilter: "blur(60px) saturate(200%) brightness(1.06)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2), 0 60px 120px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08)",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {/* Specular sweep */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgba(255,255,255,0.13) 0%, transparent 45%, rgba(255,255,255,0.04) 100%)", borderRadius: "inherit", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Logo size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Vigil Vault</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Active · Devnet</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 99, padding: "5px 12px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Protected</span>
        </div>
      </div>

      {/* Timer */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", marginBottom: 18, position: "relative" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Next deadline</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ v: String(days).padStart(2,"0"), l: "Days" }, { v: String(hrs).padStart(2,"0"), l: "Hours" }, { v: String(mins).padStart(2,"0"), l: "Mins" }].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Beneficiaries */}
      <div style={{ marginBottom: 18, position: "relative" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Beneficiaries</div>
        {[{ a: "0x4f2a…3b8c", p: 50, w: "50%" }, { a: "0x9e1d…72fa", p: 30, w: "30%" }, { a: "0xc3b5…aa11", p: 20, w: "20%" }].map(({ a, p, w }) => (
          <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>{a}</span>
                <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{p}%</span>
              </div>
              <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                <div style={{ height: "100%", width: w, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 99 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button style={{ width: "100%", padding: "13px", borderRadius: 14, background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.12))", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        I&apos;m alive — Check in
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // CTA smart routing
  const handleGetStarted = useCallback(async () => {
    if (!publicKey || !wallet) { router.push("/setup"); return; }
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    const existing = await fetchVaultConfig(program, publicKey);
    router.push(existing ? "/dashboard" : "/setup");
  }, [publicKey, wallet, connection, router]);

  // Scroll glass navbar
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Global cursor ambient light + card 3D parallax
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--my", `${e.clientY}px`);

      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      card.style.transform = `perspective(900px) rotateY(${dx * 12}deg) rotateX(${-dy * 8}deg) scale3d(1.02,1.02,1.02)`;
    };
    const onLeave = () => {
      const card = cardRef.current;
      if (card) card.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)";
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseleave", onLeave); };
  }, []);

  return (
    <>
      <style>{`
        :root { --mx: 50vw; --my: 50vh; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #060609; color: white; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .nav-a { color: rgba(255,255,255,0.55); font-size: 14px; font-weight: 450; text-decoration: none; letter-spacing: -0.01em; position: relative; transition: color 0.2s; }
        .nav-a::after { content: ''; position: absolute; bottom: -3px; left: 0; right: 0; height: 1px; background: #10b981; transform: scaleX(0); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
        .nav-a:hover { color: white; }
        .nav-a:hover::after { transform: scaleX(1); }
        .btn-primary { background: #10b981; color: white; border: none; border-radius: 100px; padding: 10px 22px; font-size: 14px; font-weight: 650; cursor: pointer; transition: all 0.25s cubic-bezier(0.22,1,0.36,1); letter-spacing: -0.01em; }
        .btn-primary:hover { background: #0d9668; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(16,185,129,0.35); }
        .btn-primary:active { transform: translateY(0); }
        .btn-hero { background: #10b981; color: white; border: none; border-radius: 100px; padding: 16px 40px; font-size: 17px; font-weight: 650; cursor: pointer; transition: all 0.3s cubic-bezier(0.22,1,0.36,1); letter-spacing: -0.02em; }
        .btn-hero:hover { background: #0d9668; transform: translateY(-2px); box-shadow: 0 12px 48px rgba(16,185,129,0.4); }
        .btn-ghost { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.12); border-radius: 100px; padding: 16px 36px; font-size: 17px; font-weight: 500; cursor: pointer; transition: all 0.25s; letter-spacing: -0.02em; }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
        .lg-card { border-radius: 24px; position: relative; overflow: hidden; transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s cubic-bezier(0.22,1,0.36,1); }
        .lg-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(130deg, rgba(255,255,255,0.1) 0%, transparent 50%); border-radius: inherit; pointer-events: none; z-index: 1; }
        .lg-card:hover { transform: translateY(-4px); box-shadow: 0 48px 120px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.1) !important; }
        .section-label { font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #10b981; margin-bottom: 14px; }
        .cursor-glow { position: fixed; inset: 0; pointer-events: none; z-index: 0; background: radial-gradient(600px circle at var(--mx) var(--my), rgba(16,185,129,0.045), transparent 40%); }
        @keyframes aurora-move { 0%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(60px,-40px) scale(1.08) rotate(3deg)} 66%{transform:translate(-40px,50px) scale(0.95) rotate(-2deg)} 100%{transform:translate(0,0) scale(1) rotate(0deg)} }
        @keyframes aurora2 { 0%{transform:translate(0,0) scale(1) rotate(0deg)} 40%{transform:translate(-60px,40px) scale(1.06) rotate(-4deg)} 80%{transform:translate(50px,-30px) scale(0.97) rotate(3deg)} 100%{transform:translate(0,0) scale(1) rotate(0deg)} }
        @keyframes aurora3 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-50px) scale(1.1)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes card-float { 0%,100%{transform:perspective(900px) rotateY(0deg) rotateX(0deg) translateY(0)} 50%{transform:perspective(900px) rotateY(3deg) rotateX(2deg) translateY(-10px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes grain { 0%,100%{transform:translate(0,0)} 10%{transform:translate(-2%,-3%)} 30%{transform:translate(1%,2%)} 50%{transform:translate(-1%,1%)} 70%{transform:translate(2%,-2%)} 90%{transform:translate(-1%,1%)} }
        .card-float-idle { animation: card-float 8s ease-in-out infinite; }
        @media(max-width:768px) { .desktop-only { display:none !important; } .mobile-menu-btn { display: flex !important; } .hero-grid { grid-template-columns: 1fr !important; } .hero-title { font-size: clamp(40px,10vw,64px) !important; } }
      `}</style>

      {/* Cursor glow */}
      <div className="cursor-glow" />

      {/* Aurora background */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.13) 0%, transparent 60%)", top: "-30%", left: "-20%", animation: "aurora-move 20s ease-in-out infinite", filter: "blur(1px)" }} />
        <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 60%)", bottom: "-15%", right: "-15%", animation: "aurora2 25s ease-in-out infinite", filter: "blur(1px)" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 60%)", top: "45%", left: "52%", animation: "aurora3 30s ease-in-out infinite" }} />
        {/* Grain texture */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.025, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='1'/></svg>")`, backgroundSize: "180px", animation: "grain 8s steps(10) infinite" }} />
      </div>

      {/* ── Navbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 52, display: "flex", alignItems: "center",
        padding: "0 max(24px, calc((100vw - 1100px) / 2))",
        background: scrolled ? "rgba(6,6,9,0.7)" : "transparent",
        backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={18} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Vigil</span>
        </div>

        <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 32, margin: "0 auto" }}>
          {[["#home","Home"],["#how-it-works","How it works"],["#security","Security"]].map(([h,l]) => (
            <a key={h} href={h} className="nav-a">{l}</a>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleGetStarted} className="btn-primary">Get Started</button>
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(m => !m)}
            style={{ display: "none", background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: "fixed", top: 52, left: 0, right: 0, zIndex: 99, background: "rgba(6,6,9,0.96)", backdropFilter: "blur(40px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {[["#home","Home"],["#how-it-works","How it works"],["#security","Security"]].map(([h,l]) => (
            <a key={h} href={h} className="nav-a" onClick={() => setMenuOpen(false)} style={{ fontSize: 17 }}>{l}</a>
          ))}
        </div>
      )}

      <main style={{ position: "relative", zIndex: 1 }}>

        {/* ── Hero ── */}
        <section id="home" ref={heroRef} style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "80px max(24px, calc((100vw - 1100px) / 2)) 60px" }}>
          <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 80, alignItems: "center", width: "100%" }}>

            {/* Left */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 99, padding: "6px 16px", marginBottom: 32, backdropFilter: "blur(12px)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600, letterSpacing: "0.04em" }}>Live on Solana</span>
              </div>

              <h1 className="hero-title" style={{ fontSize: "clamp(48px,6.5vw,82px)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.04em", marginBottom: 28 }}>
                What you build<br />
                today{" "}
                <span style={{ color: "#10b981", display: "inline-block" }}>lives on.</span>
              </h1>

              <p style={{ fontSize: "clamp(16px,1.4vw,19px)", color: "rgba(255,255,255,0.55)", lineHeight: 1.65, maxWidth: 480, marginBottom: 44, fontWeight: 400, letterSpacing: "-0.01em" }}>
                Vigil ensures your crypto reaches the people you choose if something happens to you. No lawyers. No lost wallets. Just on-chain truth.
              </p>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 52 }}>
                <button onClick={handleGetStarted} className="btn-hero">Get Started</button>
                <a href="#how-it-works" className="btn-ghost">Learn More</a>
              </div>

              <div style={{ display: "flex", gap: 40, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {[["100%", "Non-custodial"], ["0.005◎", "Per check-in"], ["< 2 min", "Setup time"]].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>{v}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3, fontWeight: 400 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — 3D floating card */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div className="card-float-idle" style={{ perspective: 900, width: "100%", maxWidth: 360 }}>
                <HeroCard cardRef={cardRef} />
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" style={{ padding: "120px max(24px, calc((100vw - 1100px) / 2))" }}>
          <SpringIn>
            <div style={{ marginBottom: 72, textAlign: "center" }}>
              <div className="section-label">Process</div>
              <h2 style={{ fontSize: "clamp(36px,4.5vw,60px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, marginBottom: 18 }}>How it works</h2>
              <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.65, fontWeight: 400 }}>Four steps. Set it once. Vigil does the rest forever.</p>
            </div>
          </SpringIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
            {[
              { n: "01", icon: <WalletIcon />, title: "Connect your wallet", body: "Link your Phantom or any Solana wallet. No sign-up, no email, no KYC required." },
              { n: "02", icon: <UsersIcon />, title: "Assign beneficiaries", body: "Add wallet addresses and set proportional shares. Up to 5 beneficiaries, any split." },
              { n: "03", icon: <ClockIcon />, title: "Set your check-in", body: "Choose 30, 60, or 90 days. Confirm you're alive with one click whenever you want." },
              { n: "04", icon: <BoltIcon />, title: "Automatic distribution", body: "Miss your deadline and assets distribute instantly, proportionally, on-chain. No one can stop it." },
            ].map(({ n, icon, title, body }, i) => (
              <SpringIn key={n} delay={i * 80} y={24}>
                <div className="lg-card" style={{
                  height: "100%",
                  background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
                  backdropFilter: "blur(32px) saturate(160%)",
                  WebkitBackdropFilter: "blur(32px) saturate(160%)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 24px 60px rgba(0,0,0,0.3)",
                  padding: "28px 26px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", position: "relative", zIndex: 2 }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: 700, letterSpacing: "0.05em" }}>{n}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10, position: "relative", zIndex: 2 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, fontWeight: 400, position: "relative", zIndex: 2 }}>{body}</p>
                </div>
              </SpringIn>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ padding: "0 max(24px, calc((100vw - 1100px) / 2)) 120px" }}>
          <SpringIn>
            <div style={{ marginBottom: 64, textAlign: "center" }}>
              <div className="section-label">Features</div>
              <h2 style={{ fontSize: "clamp(32px,4vw,56px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, marginBottom: 16 }}>Built for the long run</h2>
              <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", maxWidth: 440, margin: "0 auto", lineHeight: 1.65 }}>Every design decision prioritizes your peace of mind.</p>
            </div>
          </SpringIn>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 }}>
            {[
              { icon: <ShieldIcon />, title: "Fully non-custodial", body: "Your assets stay in your wallet at all times. Vigil holds only a delegate permission, never your keys." },
              { icon: <LockIcon />, title: "On-chain logic", body: "Everything runs on Solana smart contracts. No servers that can fail, no companies that can disappear." },
              { icon: <CodeIcon />, title: "Open source", body: "The program code is public and verifiable. Trust the math, not the team. Audit it yourself." },
              { icon: <GlobeIcon />, title: "Borderless", body: "Works for anyone, anywhere. No jurisdiction, no paperwork, no intermediaries. Just a wallet." },
            ].map(({ icon, title, body }, i) => (
              <SpringIn key={title} delay={i * 60} y={20}>
                <div className="lg-card" style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)",
                  backdropFilter: "blur(32px)",
                  WebkitBackdropFilter: "blur(32px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.25)",
                  padding: "28px 24px",
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.14)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: 18, position: "relative", zIndex: 2 }}>
                    {icon}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, position: "relative", zIndex: 2 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.65, position: "relative", zIndex: 2 }}>{body}</p>
                </div>
              </SpringIn>
            ))}
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" style={{ padding: "0 max(24px, calc((100vw - 1100px) / 2)) 120px" }}>
          <SpringIn>
            <div style={{
              borderRadius: 32, overflow: "hidden", position: "relative",
              background: "linear-gradient(145deg, rgba(16,185,129,0.07) 0%, rgba(255,255,255,0.03) 60%)",
              backdropFilter: "blur(48px) saturate(160%)",
              WebkitBackdropFilter: "blur(48px) saturate(160%)",
              border: "1px solid rgba(16,185,129,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15), 0 40px 100px rgba(0,0,0,0.35)",
              padding: "60px 52px",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgba(255,255,255,0.06) 0%, transparent 50%)", pointerEvents: "none" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", position: "relative" }}>

                <div>
                  <div className="section-label">Security</div>
                  <h2 style={{ fontSize: "clamp(28px,3.5vw,48px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.08, marginBottom: 20 }}>
                    Your keys.<br />Your rules.<br /><span style={{ color: "#10b981" }}>Always.</span>
                  </h2>
                  <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 36, maxWidth: 380 }}>
                    Vigil uses SPL token delegate permissions — a Solana primitive that lets a program move tokens only under exact conditions you define, without ever taking custody.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[["Solana", "Mainnet-ready"], ["Anchor", "Smart contracts"], ["SPL", "Token standard"]].map(([l, s]) => (
                      <div key={l} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 18px", backdropFilter: "blur(12px)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{l}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    ["You own your keys", "Vigil never asks for your private key or seed phrase. Ever."],
                    ["Conditional execution", "Distribution only triggers after your deadline passes — provably, on-chain."],
                    ["Revocable any time", "Cancel with one transaction. All permissions removed instantly."],
                    ["Zero trust needed", "No team or server can access your funds. Trust the contract."],
                  ].map(([t, d], i) => (
                    <SpringIn key={i} delay={i * 60} y={16}>
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 3, letterSpacing: "-0.01em" }}>{t}</div>
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{d}</div>
                        </div>
                      </div>
                    </SpringIn>
                  ))}
                </div>
              </div>
            </div>
          </SpringIn>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ padding: "0 24px 160px", textAlign: "center" }}>
          <SpringIn>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <h2 style={{ fontSize: "clamp(40px,5.5vw,72px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02, marginBottom: 22 }}>
                Secure your<br />
                <span style={{ color: "#10b981" }}>legacy today.</span>
              </h2>
              <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", marginBottom: 44, lineHeight: 1.65, maxWidth: 440, margin: "0 auto 44px" }}>
                Takes less than 2 minutes. No email, no KYC, no trust required.
              </p>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={handleGetStarted} className="btn-hero">Start with Vigil</button>
                <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", padding: "16px 36px", borderRadius: 100, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em", transition: "all 0.25s", cursor: "pointer" }}>
                  I already have one →
                </Link>
              </div>
            </div>
          </SpringIn>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px max(24px, calc((100vw - 1100px) / 2))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={16} />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>Vigil</span>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>· Your crypto. Their future.</span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <a href="https://github.com/Feli2arias/vigil" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
          >GitHub</a>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 12 }}>Powered by Solana</span>
        </div>
      </footer>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────
const s = { width: 22, height: 22, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 } as const;
const WalletIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>;
const UsersIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const ClockIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const BoltIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const ShieldIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const LockIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;
const CodeIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
const GlobeIcon = () => <svg {...s}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
