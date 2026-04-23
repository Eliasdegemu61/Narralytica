export function formatCurrencyCompact(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(decimals)}%`;
}

export function formatDomPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTimestamp(ts: string | number): string {
  const date = new Date(typeof ts === "string" ? parseInt(ts) : ts);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function getFearGreedLabel(score: number): string {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

export function getFearGreedInterpretation(score: number): string {
  if (score <= 20) return "Market participants are deeply risk-averse. Capitulation signals may precede reversal.";
  if (score <= 40) return "Sentiment remains defensive. Risk appetite is suppressed across spot and derivatives.";
  if (score <= 60) return "Sentiment is balanced. No directional edge from crowd positioning.";
  if (score <= 80) return "Elevated optimism. Positioning is stretched; watch for mean reversion.";
  return "Euphoria is dominant. Historically elevated risk of sharp corrections.";
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
