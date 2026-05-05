"use client";
import { useState } from "react";

interface Props {
  onNext: (intervalDays: number, gracePeriodDays: number) => void;
  onBack: () => void;
}

const INTERVALS = [
  { days: 30, label: "30 días", desc: "Check-in mensual" },
  { days: 60, label: "60 días", desc: "Check-in bimestral" },
  { days: 90, label: "90 días", desc: "Check-in trimestral" },
];

export function StepInterval({ onNext, onBack }: Props) {
  const [interval, setIntervalDays] = useState(30);
  const [grace, setGrace] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">¿Con qué frecuencia confirmás?</h2>
        <p className="text-gray-400 text-sm mt-2">Si no hacés check-in dentro de este período, Vigil distribuirá tus activos.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {INTERVALS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setIntervalDays(opt.days)}
            className={`p-4 rounded-xl border text-center transition-all ${
              interval === opt.days
                ? "border-emerald-500 bg-emerald-500/10 text-white"
                : "border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            <div className="text-lg font-semibold">{opt.label}</div>
            <div className="text-xs mt-1 opacity-70">{opt.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Período de gracia (opcional)</span>
          <span className="text-sm text-emerald-400 font-medium">{grace === 0 ? "Sin gracia" : `${grace} días`}</span>
        </div>
        <p className="text-xs text-gray-500">Tiempo extra después del deadline donde todavía podés hacer check-in de emergencia.</p>
        <div className="flex gap-2">
          {[0, 3, 7, 14].map(d => (
            <button
              key={d}
              onClick={() => setGrace(d)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                grace === d
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5"
              }`}
            >
              {d === 0 ? "Ninguno" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-colors">
          Atrás
        </button>
        <button
          onClick={() => onNext(interval, grace)}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
