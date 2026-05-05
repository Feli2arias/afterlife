"use client";
import { useEffect, useState, useCallback } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getProgram, fetchVaultConfig, forceExpire, executeDistribution, cancelVault } from "@/lib/vigil";
import { TimerCard } from "@/components/dashboard/TimerCard";
import { CheckinButton } from "@/components/dashboard/CheckinButton";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [vault, setVault] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState("");

  const loadVault = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const provider = new AnchorProvider(connection, wallet, {});
    const program = getProgram(provider);
    const data = await fetchVaultConfig(program, publicKey);
    if (!data) { router.push("/setup"); return; }
    setVault(data as Record<string, unknown>);
    setLoading(false);
  }, [publicKey, wallet, connection, router]);

  useEffect(() => { loadVault(); }, [loadVault]);

  async function handleSimulateDeath() {
    if (!publicKey || !wallet) return;
    setSimulating(true);
    setSimMsg("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      setSimMsg("Backdateando timer...");
      await forceExpire(program, publicKey);
      setSimMsg("Timer expirado ✓ Ejecutando distribución...");
      await executeDistribution(program, publicKey, publicKey);
      setSimMsg("✓ Distribución ejecutada. El Vigil está inactivo.");
      await loadVault();
    } catch (e: unknown) {
      setSimMsg("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSimulating(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400">Conectá tu wallet</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
      Cargando...
    </div>
  );

  const lastCheckin = (vault?.lastCheckin as { toNumber: () => number })?.toNumber?.() ?? 0;
  const intervalDays = (vault?.intervalDays as number) ?? 30;
  const gracePeriodDays = (vault?.gracePeriodDays as number) ?? 0;
  const beneficiaries = (vault?.beneficiaries as Array<{ wallet: { toBase58: () => string }; shareBps: number }>) ?? [];
  const isActive = vault?.isActive as boolean;

  const claimUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/claim/${publicKey.toBase58()}`;

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto space-y-5 pt-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vigil</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isActive ? "Tu legado está protegido." : "Vigil inactivo — distribución ejecutada."}
          </p>
        </div>
        <WalletMultiButton />
      </div>

      {isActive ? (
        <>
          <TimerCard lastCheckin={lastCheckin} intervalDays={intervalDays} gracePeriodDays={gracePeriodDays} />
          <CheckinButton onSuccess={loadVault} />
        </>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
          <div className="text-red-400 text-lg font-semibold">Distribución ejecutada</div>
          <p className="text-gray-400 text-sm">Los activos fueron enviados a los beneficiarios.</p>
          <button
            onClick={async () => {
              if (!publicKey || !wallet) return;
              const provider = new AnchorProvider(connection, wallet, {});
              const program = getProgram(provider);
              await cancelVault(program, publicKey);
              router.push("/setup");
            }}
            className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
          >
            Cerrar vault y empezar de nuevo
          </button>
        </div>
      )}

      {/* Beneficiaries */}
      {beneficiaries.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Beneficiarios</h3>
            <button
              onClick={() => navigator.clipboard.writeText(claimUrl)}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Copiar link de claim
            </button>
          </div>
          {beneficiaries.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="font-mono text-gray-400 text-xs">
                {b.wallet.toBase58().slice(0, 8)}...{b.wallet.toBase58().slice(-4)}
              </span>
              <span className="text-emerald-400 font-medium">{b.shareBps / 100}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Claim link */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
        <p className="text-xs text-gray-500">Link para tus beneficiarios</p>
        <p className="text-xs font-mono text-gray-300 break-all">{claimUrl}</p>
      </div>

      {/* Demo: simulate death */}
      {isActive && (
        <div className="border border-red-500/20 rounded-2xl p-5 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-red-400">Simular muerte (demo)</h3>
            <p className="text-xs text-gray-500 mt-1">Expira el timer y ejecuta la distribución en devnet.</p>
          </div>
          <button
            onClick={handleSimulateDeath}
            disabled={simulating}
            className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 text-sm font-medium transition-all"
          >
            {simulating ? "Simulando..." : "☠ Simular que morí"}
          </button>
          {simMsg && (
            <p className={`text-xs text-center ${simMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
              {simMsg}
            </p>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-white/5">
        <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">← Inicio</a>
      </div>
    </div>
  );
}
