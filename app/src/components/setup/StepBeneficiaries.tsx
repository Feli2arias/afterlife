"use client";
import { useState } from "react";
import { BeneficiaryInput } from "@/lib/afterlife";

interface Props {
  onNext: (beneficiaries: BeneficiaryInput[]) => void;
}

export function StepBeneficiaries({ onNext }: Props) {
  const [rows, setRows] = useState([{ email: "", share: 100 }]);
  const [error, setError] = useState("");

  const totalShare = rows.reduce((s, r) => s + r.share, 0);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function addRow() {
    setRows(prev => [...prev, { email: "", share: 0 }]);
  }

  function updateRow(i: number, field: "email" | "share", value: string | number) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function validate(): Promise<BeneficiaryInput[] | null> {
    if (totalShare !== 100) { setError("Los porcentajes deben sumar 100%"); return null; }
    const result: BeneficiaryInput[] = [];
    for (const row of rows) {
      if (!EMAIL_RE.test(row.email.trim())) {
        setError(`Email inválido: ${row.email}`);
        return null;
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(row.email.trim().toLowerCase());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data.buffer.slice(0) as ArrayBuffer);
      result.push({ emailHash: Array.from(new Uint8Array(hashBuffer)), shareBps: row.share * 100 });
    }
    return result;
  }

  async function handleNext() {
    const valid = await validate();
    if (valid) { setError(""); onNext(valid); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">¿Quién recibe tus activos?</h2>
        <p className="text-gray-400 text-sm mt-2">Ingresá el email de cada beneficiario y el porcentaje que le corresponde.</p>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="email"
              placeholder="heredero@email.com"
              value={row.email}
              onChange={e => updateRow(i, "email", e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={row.share}
              onChange={e => updateRow(i, "share", Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-center focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <span className="text-gray-400 text-sm w-4">%</span>
            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={addRow}
          disabled={rows.length >= 5}
          className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
        >
          + Agregar beneficiario
        </button>
        <span className={`text-sm font-medium ${totalShare === 100 ? "text-emerald-400" : "text-red-400"}`}>
          Total: {totalShare}%
        </span>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleNext}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors"
      >
        Continuar
      </button>
    </div>
  );
}
