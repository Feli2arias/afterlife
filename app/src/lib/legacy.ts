export type LegacyStrategyKind = "instant" | "protected" | "generational" | "custom";

export interface InstantConfig {
  kind: "instant";
}

export interface ProtectedConfig {
  kind: "protected";
  vestingYears: number;
  unlockFrequency: "monthly" | "quarterly";
  unlockPercent: number;
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
  unlockPercent: 5,
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
  const perUnlock = totalAssets * (cfg.unlockPercent / 100);
  return {
    perPeriod,
    totalPeriods,
    perUnlock,
    totalDistributed: Math.min(totalAssets, perUnlock * totalPeriods),
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
