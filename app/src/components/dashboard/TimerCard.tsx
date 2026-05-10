"use client";
import { useEffect, useState } from "react";

interface Props {
  lastCheckin: number;
  intervalDays: number;
  gracePeriodDays: number;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, mins: 0, expired: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return { days, hours, mins, expired: false };
}

export function TimerCard({ lastCheckin, intervalDays, gracePeriodDays }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const deadline = (lastCheckin + intervalDays * 86400) * 1000;
  const remaining = deadline - now;
  const { days, hours, mins, expired } = formatRemaining(remaining);
  const pct = Math.max(0, Math.min(100, (remaining / (intervalDays * 86400000)) * 100));
  const isWarning = days < 7 && !expired;

  const statusColor = expired ? "bg-red-500/20 text-red-400" : isWarning ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400";
  const barColor = expired ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Próximo check-in requerido</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
          {expired ? "EXPIRADO" : isWarning ? "PRÓXIMO" : "ACTIVO"}
        </span>
      </div>

      {!expired ? (
        <div className="flex gap-8">
          {[{ v: days, l: "días" }, { v: hours, l: "horas" }, { v: mins, l: "min" }].map(({ v, l }) => (
            <div key={l} className="text-center">
              <div className="text-4xl font-bold tabular-nums">{v}</div>
              <div className="text-xs text-gray-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-red-400 text-lg font-semibold">Tu Afterlife ha expirado</div>
      )}

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      {gracePeriodDays > 0 && (
        <p className="text-xs text-gray-500">
          + {gracePeriodDays} días de gracia disponibles después del deadline
        </p>
      )}
    </div>
  );
}
