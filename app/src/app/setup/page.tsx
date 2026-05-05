"use client";
import { useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import { StepBeneficiaries } from "@/components/setup/StepBeneficiaries";
import { StepInterval } from "@/components/setup/StepInterval";
import { StepDelegates } from "@/components/setup/StepDelegates";
import { getProgram, registerVault, BeneficiaryInput } from "@/lib/vigil";
import { useRouter } from "next/navigation";

type Step = "beneficiaries" | "interval" | "delegates";

export default function SetupPage() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [step, setStep] = useState<Step>("beneficiaries");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryInput[]>([]);
  const [intervalDays, setIntervalDays] = useState(30);
  const [gracePeriodDays, setGracePeriodDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Conectá tu wallet para comenzar</h1>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const steps: Step[] = ["beneficiaries", "interval", "delegates"];
  const currentIndex = steps.indexOf(step);

  async function handleFinish(_delegated: string[]) {
    if (!publicKey || !wallet) return;
    setLoading(true);
    setError("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);

      // Si el vault ya existe, ir directo al dashboard
      const { fetchVaultConfig } = await import("@/lib/vigil");
      const existing = await fetchVaultConfig(program, publicKey);
      if (existing) {
        router.push("/dashboard");
        return;
      }

      await registerVault(program, publicKey, beneficiaries, intervalDays, gracePeriodDays);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar el vault");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <a href="/" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">← Vigil</a>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentIndex ? "bg-emerald-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {step === "beneficiaries" && (
          <StepBeneficiaries onNext={(b) => { setBeneficiaries(b); setStep("interval"); }} />
        )}
        {step === "interval" && (
          <StepInterval
            onNext={(days, grace) => { setIntervalDays(days); setGracePeriodDays(grace); setStep("delegates"); }}
            onBack={() => setStep("beneficiaries")}
          />
        )}
        {step === "delegates" && (
          <StepDelegates
            onNext={handleFinish}
            onBack={() => setStep("interval")}
          />
        )}

        {loading && (
          <div className="mt-4 text-center text-sm text-gray-400">Registrando tu Vigil en Solana...</div>
        )}
        {error && (
          <div className="mt-4 text-center text-sm text-red-400">{error}</div>
        )}
      </div>
    </div>
  );
}
