export type LegacyStrategyKind = "instant" | "protected" | "generational" | "custom";

export interface InstantConfig {
  kind: "instant";
}

export interface ProtectedConfig {
  kind: "protected";
  vestingYears: number;
  unlockFrequency: "monthly" | "quarterly";
}

export interface GenerationalConfig {
  kind: "generational";
  estimatedApy: number;
  payoutFrequency: "monthly" | "quarterly" | "yearly";
}

export interface CustomConfig {
  kind: "custom";
  notes?: string;
}

export type LegacyStrategy = InstantConfig | ProtectedConfig | GenerationalConfig | CustomConfig;

export const DEFAULT_PROTECTED: ProtectedConfig = {
  kind: "protected",
  vestingYears: 5,
  unlockFrequency: "monthly",
};

export const DEFAULT_GENERATIONAL: GenerationalConfig = {
  kind: "generational",
  estimatedApy: 7,
  payoutFrequency: "monthly",
};

export const STRATEGY_META: Record<LegacyStrategyKind, { title: string; tagline: string; accent: string }> = {
  instant: {
    title: "Instant Transfer",
    tagline: "Assets become fully claimable the moment your legacy activates.",
    accent: "#10b981",
  },
  protected: {
    title: "Protected Inheritance",
    tagline: "Released gradually over time to preserve your family's future.",
    accent: "#3b82f6",
  },
  generational: {
    title: "Generational Vault",
    tagline: "Principal stays locked. Yield supports your family for generations.",
    accent: "#a855f7",
  },
  custom: {
    title: "Custom Strategy",
    tagline: "Programmable rules — vesting, milestones, education funds, and more.",
    accent: "#f59e0b",
  },
};

export function storageKey(ownerPk: string): string {
  return `afterlife_strategy_${ownerPk}`;
}

export function loadStrategy(ownerPk: string): LegacyStrategy | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(ownerPk));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LegacyStrategy;
  } catch {
    return null;
  }
}

export function saveStrategy(ownerPk: string, strategy: LegacyStrategy): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey(ownerPk), JSON.stringify(strategy));
}

export function unlocksPerYear(freq: "monthly" | "quarterly"): number {
  return freq === "monthly" ? 12 : 4;
}

export function protectedSchedule(cfg: ProtectedConfig, totalAssets: number) {
  const perPeriod = unlocksPerYear(cfg.unlockFrequency);
  const totalPeriods = cfg.vestingYears * perPeriod;
  const unlockPercent = totalPeriods > 0 ? 100 / totalPeriods : 0;
  const perUnlock = totalAssets / totalPeriods;
  return {
    perPeriod,
    totalPeriods,
    unlockPercent,
    perUnlock,
    totalDistributed: totalAssets,
  };
}

export function projectGenerational(cfg: GenerationalConfig, principal: number, years: number) {
  const points: Array<{ year: number; value: number; yieldThisYear: number }> = [];
  let value = principal;
  const yearlyRate = cfg.estimatedApy / 100;
  for (let y = 0; y <= years; y++) {
    const yieldThisYear = y === 0 ? 0 : value * yearlyRate;
    points.push({ year: y, value, yieldThisYear });
    value = value * (1 + yearlyRate);
  }
  return points;
}

export function monthlyPayout(cfg: GenerationalConfig, principal: number): number {
  const annualYield = principal * (cfg.estimatedApy / 100);
  const divisor = cfg.payoutFrequency === "monthly" ? 12 : cfg.payoutFrequency === "quarterly" ? 4 : 1;
  return annualYield / divisor;
}

export function strategyLabel(s: LegacyStrategy | null): string {
  if (!s) return "Instant Transfer";
  return STRATEGY_META[s.kind].title;
}

export function encodeStrategyForUrl(s: LegacyStrategy): string {
  const json = JSON.stringify(s);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeStrategyFromUrl(token: string): LegacyStrategy | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const json = typeof window === "undefined"
      ? Buffer.from(padded, "base64").toString("utf-8")
      : decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && typeof parsed.kind === "string") {
      return parsed as LegacyStrategy;
    }
    return null;
  } catch {
    return null;
  }
}

export function strategyHumanSummary(s: LegacyStrategy): string {
  if (s.kind === "instant") return "Full amount available immediately";
  if (s.kind === "protected") {
    const periodLabel = s.unlockFrequency === "monthly" ? "month" : "quarter";
    return `Released ${s.unlockFrequency} over ${s.vestingYears} ${s.vestingYears === 1 ? "year" : "years"} — equal portions each ${periodLabel}`;
  }
  if (s.kind === "generational") return `Principal preserved · ${s.payoutFrequency} yield payouts @ ~${s.estimatedApy}% APY`;
  return "Custom programmable rules";
}
