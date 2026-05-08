"use client";
import { useCallback } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { Fingerprint, Lock, ShieldCheck, ArrowRight, Clock, Activity, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useRouter } from "next/navigation";
import { getProgram, fetchVaultConfig } from "@/lib/vigil";

// ─── Smart CTA hook ───────────────────────────────────────────────────────────
function useSmartCta() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();

  return useCallback(async () => {
    router.push("/setup");
  }, [router]);
}

// ─── Components ───────────────────────────────────────────────────────────────

const AfterlifeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <img src="/logo.png" alt="Afterlife Logo" className={`${className} object-contain`} />
);

const MagneticButton = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  return (
    <motion.button
      ref={ref}
      onMouseMove={(e) => {
        const { width, height, left, top } = ref.current!.getBoundingClientRect();
        x.set(e.clientX - (left + width / 2));
        y.set(e.clientY - (top + height / 2));
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      onClick={onClick}
      style={{ x: springX, y: springY }}
      className={`relative overflow-hidden rounded-full font-medium transition-all group ${className}`}
    >
      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-full" />
      {children}
    </motion.button>
  );
};

const SpotlightCard = ({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  return (
    <div
      onMouseMove={(e) => {
        const { left, top } = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - left);
        mouseY.set(e.clientY - top);
      }}
      className={`group relative rounded-3xl liquid-glass overflow-hidden ${className}`}
      style={style}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl transition duration-500 opacity-0 group-hover:opacity-100 z-10"
        style={{
          background: useMotionTemplate`radial-gradient(800px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
      <div className="relative z-20 h-full w-full">{children}</div>
    </div>
  );
};

// ─── Background ───────────────────────────────────────────────────────────────

const FluidAmbientGlow = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1400px] h-[100vh] opacity-60 mix-blend-screen pointer-events-none">
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute top-[5%] right-[10%] w-[60%] h-[70%] bg-[#e3d5ca]/10 blur-[150px] rounded-[100%] origin-bottom-left"
      />
      <motion.div
        animate={{ rotate: -360, scale: [1, 1.15, 1] }}
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[20%] left-[10%] w-[55%] h-[55%] bg-[#a1a1aa]/5 blur-[150px] rounded-[100%] origin-top-right"
      />
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-[#d4a373]/5 blur-[120px] rounded-[100%]"
      />
    </div>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030303]/40 to-[#030303] pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_20%,#030303_95%)] pointer-events-none" />
  </div>
);

// ─── Navbar ───────────────────────────────────────────────────────────────────

const Navbar = ({ onLaunch }: { onLaunch: () => void }) => {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setIsScrolled(v > 100));

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex justify-center p-4 px-6 pointer-events-none">
      <nav className={`pointer-events-auto flex justify-between items-center w-full max-w-7xl transition-all duration-500 rounded-[2rem] ${
        isScrolled ? "py-3 px-6 liquid-glass border border-white/10 shadow-2xl" : "py-4 px-2 bg-transparent mix-blend-difference"
      }`}>
        <div className="flex items-center gap-2 text-white font-semibold tracking-tight text-xl">
          <AfterlifeLogo className="w-8 h-8" />
          Afterlife
        </div>
        <div className={`hidden md:flex items-center gap-8 text-[13px] font-medium tracking-wide transition-colors duration-500 ${isScrolled ? "text-[#a1a1a1]" : "text-[#b5b5b5]"}`}>
          <a href="#mechanics" className="hover:text-white transition-colors">Protocol</a>
          <a href="#mechanics" className="hover:text-white transition-colors">Mechanics</a>
        </div>
        <div className="relative">
          <button
            onClick={onLaunch}
            className={`relative z-10 text-[13px] tracking-wide font-medium bg-white text-black px-4 py-2 rounded-full transition-all duration-300 inline-block hover:scale-105`}
          >
            Secure Your Legacy
          </button>
          {isScrolled && (
            <motion.div
              className="absolute inset-0 bg-white rounded-full blur-md pointer-events-none"
              animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.15, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </nav>
    </div>
  );
};

// ─── FloatingVault card ───────────────────────────────────────────────────────

const FloatingVault = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [15, -15]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [-15, 15]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <motion.div ref={containerRef} style={{ rotateX, rotateY, y }} className="relative w-full max-w-[400px] aspect-square mx-auto perspective-1000">
      <div className="absolute inset-0 bg-white/5 blur-[120px] rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/10 blur-[60px] mix-blend-screen z-10" />
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 liquid-glass rounded-[2.5rem] flex items-center justify-center p-8 z-30"
      >
        <div className="w-full h-full border border-white/10 rounded-[1.5rem] flex flex-col justify-between p-6">
          <div className="flex justify-between items-center">
            <AfterlifeLogo className="w-8 h-8 text-white/70" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#888] font-mono">Status: Active</span>
              <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <div className="h-1.5 w-24 bg-white/20 rounded-full mb-1" />
                <div className="h-1 w-16 bg-white/10 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Clock className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <div className="h-1.5 w-20 bg-white/20 rounded-full mb-1" />
                <div className="h-1 w-12 bg-white/10 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute inset-0 liquid-glass rounded-[2.5rem] p-8 -z-10 translate-y-8 scale-95 opacity-80"
      />
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute inset-0 liquid-glass-dark rounded-[2.5rem] p-8 -z-20 translate-y-16 scale-90 opacity-40 border border-white/5"
      />
    </motion.div>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroSection = ({ onLaunch }: { onLaunch: () => void }) => {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);
  const yText = useTransform(scrollY, [0, 600], [0, 50]);

  return (
    <section className="relative min-h-screen md:h-[110vh] flex flex-col justify-center px-6 overflow-hidden">
      <motion.div style={{ opacity }} className="absolute inset-0 z-0">
        <motion.img
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.8, ease: "easeOut" }}
          src="/hero-image.png"
          alt="Afterlife Hero"
          className="w-full h-full object-cover object-[80%_center] grayscale-[0.2] brightness-[0.7] contrast-[1.1]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=2000";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030303] via-[#030303]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent" />
      </motion.div>

      <div className="relative z-0"><FluidAmbientGlow /></div>

      <div className="max-w-7xl w-full mx-auto relative z-10 flex pt-10 md:pt-14">
        <motion.div style={{ opacity, y: yText }} className="flex flex-col items-start text-left space-y-8 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 liquid-glass mb-6"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-black">
              <svg width="12" height="12" viewBox="0 0 397 311" fill="none">
                <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#A1A1AA"/>
                <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#A1A1AA"/>
                <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#A1A1AA"/>
              </svg>
            </div>
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-[#888]">Built on Solana</span>
          </motion.div>

          <div className="space-y-6">
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-[7rem] font-bold tracking-tighter leading-[0.9] text-white pb-4 drop-shadow-xl"
            >
              What you build.<br />Lives on.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-[#d0d0d0] font-medium tracking-tight max-w-xl drop-shadow-md"
            >
              What you leave behind shouldn't be left to chance. Afterlife is a non-custodial protocol on Solana that ensures your digital legacy reaches the people you choose.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center gap-6 pt-4"
          >
            <MagneticButton
              onClick={onLaunch}
              className="bg-white text-black border border-white px-8 py-4 text-lg font-semibold tracking-tight flex items-center gap-2 hover:bg-transparent hover:text-white transition-all"
            >
              Secure Your Legacy <ArrowRight className="w-5 h-5" />
            </MagneticButton>
            <button className="text-[15px] font-medium tracking-tight text-[#d0d0d0] hover:text-white transition-colors flex items-center gap-1 drop-shadow-md">
              Learn how it works <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#030303] to-transparent z-20 pointer-events-none" />
    </section>
  );
};

// ─── Architecture (bento) ─────────────────────────────────────────────────────

const ArchitectureSection = ({ onLaunch }: { onLaunch: () => void }) => (
  <section id="mechanics" className="py-32 px-6 relative z-20">
    <div className="max-w-7xl mx-auto space-y-24">
      <div className="text-center space-y-6">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter titanium-text">
          100% Non-Custodial.<br /> Absolute Control.
        </h2>
        <p className="text-xl text-[#888] max-w-2xl mx-auto font-medium tracking-tight">
          We don&apos;t hold keys. We don&apos;t hold assets. Your funds never leave your wallet until the protocol executes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
        <SpotlightCard className="md:col-span-2 md:row-span-2 p-10 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-full liquid-glass-dark border border-white/10 flex items-center justify-center mb-6">
              <Lock className="w-5 h-5 text-white/80" />
            </div>
            <h3 className="text-3xl font-bold tracking-tight mb-4">On-Chain Dead Man&apos;s Switch</h3>
            <p className="text-[#888] text-lg max-w-md leading-relaxed">
              Configure your check-in interval (30, 60, or 90 days) and a grace period. Keepers securely execute the distribution to your beneficiaries only if your timer expires.
            </p>
          </div>
          <div className="relative w-full h-48 mt-8 border-t border-white/10 pt-8 flex items-center justify-between">
            <div className="flex flex-col items-center gap-3">
              <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_#fff] animate-pulse" />
              <span className="text-xs uppercase tracking-widest text-[#888] font-medium">Check-in</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-white/20 via-white/5 to-white/20 relative">
              <motion.div
                animate={{ x: ["0%", "100%", "0%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 -translate-y-1/2 w-32 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.7)]"
              />
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-[10px] uppercase font-mono tracking-widest text-[#555]">Interval: 90 Days</div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-4 h-4 border-2 border-white/40 rounded-full" />
              <span className="text-xs uppercase tracking-widest text-[#555] font-medium">Execute</span>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-8 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-full liquid-glass-dark border border-white/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-2">Token Delegation</h3>
            <p className="text-[#888] text-sm leading-relaxed">
              Assets are authorized via SPL Token Delegation. Native SOL is converted to wSOL for seamless delegation. You retain full access.
            </p>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-8 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-full liquid-glass-dark border border-white/10 flex items-center justify-center mb-6">
              <Activity className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-2">Multi-Beneficiary</h3>
            <p className="text-[#888] text-sm leading-relaxed">
              Assign up to 5 individual wallets with custom percentage distributions (totaling 100%).
            </p>
          </div>
        </SpotlightCard>

        <SpotlightCard className="md:col-span-3 h-[auto] min-h-[250px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <h3 className="text-3xl font-bold tracking-tight mb-4">Claim Portal</h3>
            <p className="text-[#888] text-lg leading-relaxed">
              Once executed, beneficiaries simply visit the claim portal to unwrap and receive their delegated assets. Transparent, permissionless, and instant.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 liquid-glass-dark p-6 rounded-2xl border border-white/10">
            <div className="text-xs font-mono text-[#888]">Beneficiary Claim</div>
            <div className="font-mono text-sm text-white/70">{"unwrap(wSOL) → native SOL"}</div>
            <div className="h-px w-full bg-white/10 my-2" />
            <div className="font-mono text-xs text-[#555]">afterlife.vercel.app/claim</div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  </section>
);

// ─── Final CTA ────────────────────────────────────────────────────────────────

const FinalSection = ({ onLaunch }: { onLaunch: () => void }) => (
  <section className="py-32 px-6 relative z-20 overflow-hidden text-center mix-blend-screen">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-white/5 blur-[150px] rounded-[100%] pointer-events-none" />
    <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center">
      <AfterlifeLogo className="w-20 h-20 mb-10 text-white" />
      <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 leading-[0.9] titanium-text">
        Designed for eternity.
      </h2>
      <p className="text-xl text-[#888] mb-12 max-w-2xl font-medium tracking-tight">
        Initialize your vault on Solana today. Cancel anytime. Protect your legacy infinitely.
      </p>
      <MagneticButton
        onClick={onLaunch}
        className="liquid-glass border border-white/20 px-10 py-5 text-white text-xl font-medium tracking-tight hover:bg-white hover:text-black hover:scale-105"
      >
        Begin Your Legacy
      </MagneticButton>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = () => (
  <footer className="border-t border-white/5 py-12 px-6 relative z-20 bg-black/50 backdrop-blur-xl">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
      <div className="text-white font-semibold tracking-tight flex items-center gap-2">
        <AfterlifeLogo className="w-6 h-6" />
        Afterlife
      </div>
      <div className="flex gap-8 text-[13px] text-[#666] font-medium tracking-wide uppercase">
        <span className="hover:text-white transition-colors cursor-default">Solana Devnet</span>
        <span className="hover:text-white transition-colors cursor-default">Non-Custodial</span>
        <span className="hover:text-white transition-colors cursor-default">Open Protocol</span>
      </div>
    </div>
  </footer>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const handleLaunch = useSmartCta();

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-white/20 relative">
      <div className="fixed inset-0 z-[100] bg-noise pointer-events-none mix-blend-overlay" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{ x: ["-10%", "10%", "-10%"], y: ["-10%", "10%", "-10%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-[100%] bg-[radial-gradient(circle_at_center,rgba(20,241,149,0.03)_0%,transparent_60%)] blur-[80px]"
        />
        <motion.div
          animate={{ x: ["5%", "-15%", "5%"], y: ["15%", "-5%", "15%"] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-[100%] bg-[radial-gradient(circle_at_center,rgba(20,241,149,0.02)_0%,transparent_60%)] blur-[100px]"
        />
      </div>

      <Navbar onLaunch={handleLaunch} />
      <HeroSection onLaunch={handleLaunch} />
      <ArchitectureSection onLaunch={handleLaunch} />
      <FinalSection onLaunch={handleLaunch} />
      <Footer />

    </div>
  );
}
