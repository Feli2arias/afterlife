"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
    <path d="M4 16 L10 10 L16 20 L22 6 L28 16" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="28" cy="16" r="3" fill="#10b981" />
  </svg>
);

const IconShield = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const IconWallet = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

const IconUsers = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const IconClock = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconBolt = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const IconLock = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const IconCode = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
  </svg>
);

const IconGlobe = () => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

function HeroCard() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const days = 23, hours = (tick % 24), mins = (tick % 60);

  return (
    <div
      className="relative w-full max-w-sm mx-auto"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "24px",
        padding: "28px",
        backdropFilter: "blur(24px)",
        boxShadow: "0 0 80px rgba(16,185,129,0.08), 0 32px 64px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Logo />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>Vigil Vault</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 20, padding: "4px 10px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>Protected</span>
        </div>
      </div>

      {/* Timer */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Next check-in deadline</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { v: String(days).padStart(2, "0"), l: "Days" },
            { v: String(hours).padStart(2, "0"), l: "Hours" },
            { v: String(mins).padStart(2, "0"), l: "Mins" },
          ].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, background: "rgba(16,185,129,0.06)", borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Beneficiaries */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Beneficiaries</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "0x4f2a...3b8c", pct: 50, color: "#10b981" },
            { label: "0x9e1d...72fa", pct: 30, color: "#34d399" },
            { label: "0xc3b5...aa11", pct: 20, color: "#6ee7b7" },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#d1d5db", fontFamily: "monospace" }}>{label}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, opacity: 0.7 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in button */}
      <button
        style={{
          width: "100%", padding: "12px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))",
          border: "1px solid rgba(16,185,129,0.3)",
          color: "#10b981", fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
        I&apos;m still here — Check in
      </button>
    </div>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#050505", color: "white", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>

      {/* ── Background blobs ── */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", width: 900, height: 900, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%)",
          top: "-20%", left: "-15%",
          animation: "blob1 18s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 65%)",
          bottom: "-10%", right: "-10%",
          animation: "blob2 22s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 65%)",
          top: "40%", left: "55%",
          animation: "blob3 26s ease-in-out infinite",
        }} />
      </div>

      <style>{`
        @keyframes blob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.05)} 66%{transform:translate(-30px,50px) scale(0.97)} }
        @keyframes blob2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,30px) scale(1.04)} 66%{transform:translate(40px,-50px) scale(0.98)} }
        @keyframes blob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-60px,40px) scale(1.06)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        .nav-link { color: #9ca3af; font-size: 14px; transition: color 0.2s; text-decoration: none; }
        .nav-link:hover { color: white; }
        .step-card { transition: transform 0.3s, box-shadow 0.3s; }
        .step-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .feature-card { transition: transform 0.3s, border-color 0.3s; }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(16,185,129,0.3) !important; }
        .cta-btn { transition: background 0.2s, transform 0.15s, box-shadow 0.2s; }
        .cta-btn:hover { background: #059669 !important; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(16,185,129,0.3); }
        .cta-btn:active { transform: translateY(0); }
        .outline-btn { transition: background 0.2s, border-color 0.2s; }
        .outline-btn:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.2) !important; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #050505; } ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 3px; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(5,5,5,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>Vigil</span>
        </div>

        {/* Desktop links */}
        <div style={{ display: "flex", gap: 32, alignItems: "center" }} className="hidden-mobile">
          {["Home", "How it works", "Security"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="nav-link">{l}</a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/setup" className="cta-btn" style={{
            padding: "8px 20px", borderRadius: 10, background: "#10b981",
            color: "white", fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}>
            Get Started
          </Link>
          <button onClick={() => setMenuOpen(m => !m)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4, display: "none" }} className="menu-btn" aria-label="menu">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </nav>

      <style>{`
        @media(max-width:768px){.hidden-mobile{display:none!important}.menu-btn{display:flex!important}}
      `}</style>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, zIndex: 99, background: "rgba(5,5,5,0.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {["Home", "How it works", "Security"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="nav-link" onClick={() => setMenuOpen(false)} style={{ fontSize: 16 }}>{l}</a>
          ))}
        </div>
      )}

      {/* ── Hero ── */}
      <section id="home" style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", padding: "0 24px", paddingTop: 64 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 99, padding: "6px 14px", marginBottom: 28 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>Live on Solana Devnet</span>
            </div>

            <h1 style={{ fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24 }}>
              What you build<br />
              <span style={{ color: "#10b981" }}>today</span> lives on.
            </h1>

            <p style={{ fontSize: 18, color: "#9ca3af", lineHeight: 1.7, maxWidth: 480, marginBottom: 40 }}>
              Vigil ensures your crypto reaches the people you choose if something happens to you. No lawyers. No lost wallets. Just on-chain truth.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/setup" className="cta-btn" style={{
                padding: "14px 32px", borderRadius: 12, background: "#10b981",
                color: "white", fontSize: 15, fontWeight: 700, textDecoration: "none",
                display: "inline-block",
              }}>
                Get Started
              </Link>
              <a href="#how-it-works" className="outline-btn" style={{
                padding: "14px 32px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#d1d5db", fontSize: 15, fontWeight: 500, textDecoration: "none",
                display: "inline-block",
              }}>
                Learn More
              </a>
            </div>

            <div style={{ display: "flex", gap: 32, marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { v: "100%", l: "Non-custodial" },
                { v: "0.005◎", l: "Per check-in" },
                { v: "∞", l: "Beneficiaries" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{v}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating card */}
          <div style={{ animation: "float 6s ease-in-out infinite" }}>
            <HeroCard />
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.4 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#6b7280" }}>SCROLL</span>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)" }} />
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ position: "relative", zIndex: 1, padding: "120px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 64 }}>
            <FadeIn className="text-center">
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Process</div>
              <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>How it works</h2>
              <p style={{ fontSize: 17, color: "#6b7280", maxWidth: 500, margin: "0 auto" }}>Four simple steps. Set it once. Vigil handles the rest.</p>
            </FadeIn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {[
              { n: "01", icon: <IconWallet />, title: "Connect your wallet", desc: "Link your Phantom or any Solana wallet. No sign-up, no email required." },
              { n: "02", icon: <IconUsers />, title: "Assign beneficiaries", desc: "Add wallet addresses and set proportional shares. Up to 5 beneficiaries." },
              { n: "03", icon: <IconClock />, title: "Set your check-in", desc: "Choose 30, 60, or 90 day intervals. Confirm you're alive with one click." },
              { n: "04", icon: <IconBolt />, title: "Automatic distribution", desc: "If you miss your deadline, assets are distributed instantly on-chain." },
            ].map(({ n, icon, title, desc }, i) => (
              <FadeIn key={n} delay={i * 100}>
                <div className="step-card" style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20, padding: "28px 24px", height: "100%",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "white" }}>{title}</h3>
                  <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 24px 120px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 64 }}>
            <FadeIn className="text-center">
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Features</div>
              <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>Built for the long run</h2>
              <p style={{ fontSize: 17, color: "#6b7280", maxWidth: 480, margin: "0 auto" }}>Every design decision puts your peace of mind first.</p>
            </FadeIn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {[
              { icon: <IconShield />, title: "Fully non-custodial", desc: "Your assets stay in your wallet at all times. Vigil only holds a delegate permission, never your keys." },
              { icon: <IconLock />, title: "On-chain logic", desc: "Everything runs on Solana smart contracts. No servers that can fail, no companies that can disappear." },
              { icon: <IconCode />, title: "Open source", desc: "The program code is public and verifiable. Audit it yourself — trust the math, not the team." },
              { icon: <IconGlobe />, title: "Borderless inheritance", desc: "Works for anyone, anywhere. No jurisdiction, no paperwork, no intermediaries needed." },
            ].map(({ icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 80}>
                <div className="feature-card" style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20, padding: "28px 24px",
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: 18 }}>
                    {icon}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "white" }}>{title}</h3>
                  <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section id="security" style={{ position: "relative", zIndex: 1, padding: "0 24px 120px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,5,5,0) 60%)",
            border: "1px solid rgba(16,185,129,0.12)",
            borderRadius: 28, padding: "60px 48px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center",
          }}>
            <FadeIn>
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Security</div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.1 }}>
                Your keys.<br />Your rules.<br /><span style={{ color: "#10b981" }}>Always.</span>
              </h2>
              <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
                Vigil uses SPL token delegate permissions — a Solana primitive that lets a program move tokens only under exact conditions you define, without ever taking custody.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  { label: "Solana", sub: "Mainnet-ready" },
                  { label: "Anchor", sub: "Smart contracts" },
                  { label: "SPL", sub: "Token standard" },
                ].map(({ label, sub }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={150}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { title: "You own your keys", desc: "Vigil never asks for your private key or seed phrase." },
                  { title: "Conditional execution", desc: "Distribution only triggers after your deadline passes — provably, on-chain." },
                  { title: "Revocable at any time", desc: "Cancel your vault with one transaction. All permissions removed instantly." },
                  { title: "Zero trust needed", desc: "No team or server can access your funds. Trust the contract, not us." },
                ].map(({ title, desc }, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ marginTop: 2, flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 24px 140px" }}>
        <FadeIn>
          <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 20 }}>
              Secure your<br /><span style={{ color: "#10b981" }}>legacy today.</span>
            </h2>
            <p style={{ fontSize: 17, color: "#6b7280", marginBottom: 40, lineHeight: 1.7 }}>
              Takes less than 2 minutes to set up. No email, no KYC, no trust required.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/setup" className="cta-btn" style={{
                padding: "16px 40px", borderRadius: 14, background: "#10b981",
                color: "white", fontSize: 16, fontWeight: 700, textDecoration: "none", display: "inline-block",
              }}>
                Start with Vigil
              </Link>
              <Link href="/dashboard" className="outline-btn" style={{
                padding: "16px 32px", borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af", fontSize: 16, fontWeight: 500, textDecoration: "none", display: "inline-block",
              }}>
                I already have one →
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Vigil</span>
            <span style={{ color: "#374151", fontSize: 14 }}>· Your crypto. Their future.</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <a href="https://github.com/Feli2arias/vigil" target="_blank" rel="noopener noreferrer" style={{ color: "#4b5563", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
               onMouseEnter={e => (e.currentTarget.style.color = "#9ca3af")}
               onMouseLeave={e => (e.currentTarget.style.color = "#4b5563")}
            >GitHub</a>
            <span style={{ color: "#1f2937", fontSize: 13 }}>Powered by Solana</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
