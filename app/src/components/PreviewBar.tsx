"use client";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { label: "Landing", href: "/" },
  { label: "Setup", href: "/setup?demo=1" },
  { label: "Dashboard", href: "/dashboard?demo=1" },
  { label: "Claim", href: "/claim/DEMO?demo=1" },
];

export default function PreviewBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", alignItems: "center", gap: 6,
      background: "rgba(10,10,10,0.85)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 999, padding: "6px 8px",
      backdropFilter: "blur(40px) saturate(180%)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
    }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 6, paddingRight: 2 }}>Preview</span>
      <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
      {LINKS.map(({ label, href }) => {
        const base = href.split("?")[0];
        const active = pathname === base;
        return (
          <button
            key={label}
            onClick={() => router.push(href)}
            style={{
              padding: "5px 14px", borderRadius: 999,
              background: active ? "rgba(255,255,255,0.12)" : "transparent",
              border: active ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.45)",
              fontSize: 12, fontWeight: active ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
