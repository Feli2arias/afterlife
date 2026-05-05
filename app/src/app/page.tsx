import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-10">
      {/* Logo */}
      <div className="space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M4 16 L10 10 L16 20 L22 6 L28 16" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="28" cy="16" r="3" fill="#10b981"/>
          </svg>
        </div>
        <h1 className="text-5xl font-bold tracking-tight">Vigil</h1>
        <p className="text-gray-400 text-xl">Your crypto. Their future.</p>
      </div>

      {/* Tagline */}
      <p className="max-w-md text-gray-300 leading-relaxed">
        Si algo te pasa, tus activos llegan a quien vos elegís.<br />
        Sin abogados, sin que tu familia sepa de wallets.<br />
        Solo confirmás que seguís vivo cada mes.
      </p>

      {/* CTA */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/setup"
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors"
        >
          Configurar mi Vigil
        </Link>
        <Link
          href="/dashboard"
          className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium transition-colors border border-white/10"
        >
          Ya tengo uno →
        </Link>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-8 max-w-md text-center pt-4">
        {[
          { icon: "🔑", title: "Sin custody", desc: "Tus tokens siguen en tu wallet" },
          { icon: "⏱", title: "Timer tuyo", desc: "30, 60 o 90 días" },
          { icon: "💸", title: "0.005 SOL", desc: "Por check-in, sin sorpresas" },
        ].map(f => (
          <div key={f.title} className="space-y-2">
            <div className="text-2xl">{f.icon}</div>
            <div className="text-sm font-medium text-white">{f.title}</div>
            <div className="text-xs text-gray-500">{f.desc}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600">Powered by Solana</p>
    </div>
  );
}
