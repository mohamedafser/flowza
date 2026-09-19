export type DurationStats = {
  sampleSize: number;
  averageMinutes: number | null;
  medianMinutes: number | null;
  maximumMinutes: number | null;
};

export type PartySizeBucketKey = "1-2" | "3-4" | "5-6" | "7+";

export type PartySizeBucket = {
  key: PartySizeBucketKey;
  label: string;
  count: number;
};

export type VolumePoint = {
  key: string;
  label: string;
  count: number;
  averageWaitMinutes: number | null;
};

export type PeakHourRow = {
  hour: number;
  label: string;
  count: number;
  averageWaitMinutes: number | null;
};

export type RateValue = {
  numerator: number;
  denominator: number;
  /** null when denominator is 0 — never show a fake percentage. */
  rate: number | null;
};

function minutesBetween(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return (end - start) / 60_000;
}

export function durationMinutes(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  return minutesBetween(startIso, endIso);
}

export function summarizeDurations(
  values: readonly (number | null | undefined)[],
): DurationStats {
  const samples = values
    .filter((value): value is number => typeof value === "number" && value >= 0)
    .slice()
    .sort((a, b) => a - b);

  if (samples.length === 0) {
    return {
      sampleSize: 0,
      averageMinutes: null,
      medianMinutes: null,
      maximumMinutes: null,
    };
  }

  const sum = samples.reduce((acc, value) => acc + value, 0);
  const mid = Math.floor(samples.length / 2);
  const median =
    samples.length % 2 === 0
      ? (samples[mid - 1]! + samples[mid]!) / 2
      : samples[mid]!;

  return {
    sampleSize: samples.length,
    averageMinutes: sum / samples.length,
    medianMinutes: median,
    maximumMinutes: samples[samples.length - 1]!,
  };
}

export function computeRate(
  numerator: number,
  denominator: number,
): RateValue {
  if (denominator <= 0) {
    return { numerator, denominator: 0, rate: null };
  }
  return {
    numerator,
    denominator,
    rate: numerator / denominator,
  };
}

export function partySizeBucket(partySize: number): PartySizeBucketKey {
  if (partySize <= 2) return "1-2";
  if (partySize <= 4) return "3-4";
  if (partySize <= 6) return "5-6";
  return "7+";
}

export function partySizeBucketLabel(key: PartySizeBucketKey): string {
  switch (key) {
    case "1-2":
      return "1–2 people";
    case "3-4":
      return "3–4 people";
    case "5-6":
      return "5–6 people";
    case "7+":
      return "7+ people";
  }
}

export function buildPartySizeDistribution(
  partySizes: readonly number[],
): PartySizeBucket[] {
  const counts: Record<PartySizeBucketKey, number> = {
    "1-2": 0,
    "3-4": 0,
    "5-6": 0,
    "7+": 0,
  };

  for (const size of partySizes) {
    if (!Number.isFinite(size) || size <= 0) continue;
    counts[partySizeBucket(Math.floor(size))] += 1;
  }

  return (Object.keys(counts) as PartySizeBucketKey[]).map((key) => ({
    key,
    label: partySizeBucketLabel(key),
    count: counts[key],
  }));
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function roundMinutes(
  value: number | null,
  digits = 1,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 1) return "<1 min";
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
