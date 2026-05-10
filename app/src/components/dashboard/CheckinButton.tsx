"use client";
import { useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { getProgram, checkin } from "@/lib/afterlife";

interface Props {
  onSuccess: () => void;
}

export function CheckinButton({ onSuccess }: Props) {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckin() {
    if (!publicKey || !wallet) return;
    setLoading(true);
    setError("");
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = getProgram(provider);
      await checkin(program, publicKey);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error en el check-in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCheckin}
        disabled={loading}
        className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-lg font-semibold transition-all active:scale-[0.98]"
      >
        {loading ? "Confirmando en Solana..." : "Sigo vivo ✓"}
      </button>
      <p className="text-center text-xs text-gray-500">Costo: 0.005 SOL por check-in</p>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
