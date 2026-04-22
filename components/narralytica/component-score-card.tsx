import { formatCurrencyCompact } from "@/lib/format";
import type { ComponentCard } from "@/lib/mock-data";

const STATE_COLOR: Record<string, string> = {
  bullish: "var(--bull)",
  bearish: "var(--bear)",
  neutral: "var(--neutral-fg)",
};
const STATE_TRACK: Record<string, string> = {
  bullish: "var(--bull-track)",
  bearish: "var(--bear-track)",
  neutral: "var(--neutral-track)",
};

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className="text-[11px] font-mono shrink-0 truncate font-semibold"
        style={{ color: "var(--foreground-dim)" }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-mono text-right tabular-nums"
        style={{ color: "var(--foreground-muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

function formatEvidenceValue(key: string, val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return null;
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (
    key.includes("usd") ||
    key.includes("inflow") ||
    key.includes("interest") ||
    key.includes("price") ||
    key.includes("close") ||
    key.includes("sma")
  ) {
    const n = parseFloat(String(val));
    if (!isNaN(n) && Math.abs(n) >= 1000) return formatCurrencyCompact(n);
    if (!isNaN(n)) return n.toFixed(2);
  }
  if (key.includes("pct") || key.includes("share") || key.includes("dom")) {
    const n = parseFloat(String(val));
    if (!isNaN(n)) {
      if (Math.abs(n) < 1) return `${(n * 100).toFixed(2)}%`;
      return `${n.toFixed(2)}%`;
    }
  }
  if (key.includes("ratio")) {
    const n = parseFloat(String(val));
    if (!isNaN(n)) return n.toFixed(3);
  }
  if (key.includes("rate") || key.includes("threshold")) {
    const n = parseFloat(String(val));
    if (!isNaN(n)) return n.toFixed(6);
  }
  return String(val);
}

function formatEvidenceKey(key: string): string {
  return key.replace(/_/g, " ");
}

interface ComponentScoreCardProps {
  card: ComponentCard;
}

export function ComponentScoreCard({ card }: ComponentScoreCardProps) {
  const { name, score, state, summary, evidence, calc_hint, visual_score } = card;
  const color = STATE_COLOR[state] ?? "var(--neutral-fg)";
  const track = STATE_TRACK[state] ?? "var(--border-subtle)";

  const evidenceEntries = Object.entries(evidence).filter(
    ([k, v]) =>
      typeof v !== "object" &&
      k !== "source" &&
      k !== "latest_date" &&
      k !== "latest_time"
  );

  return (
    <div
      className="px-5 py-5 flex flex-col gap-4 h-full"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 min-w-0">
          <span
            className="text-[11px] font-mono uppercase tracking-[0.16em] px-2 py-1 self-start font-bold"
            style={{
              color,
              background: track,
              border: `1px solid ${color}20`,
            }}
          >
            {state}
            {score !== 0 ? `  ${score > 0 ? `+${score}` : score}` : ""}
          </span>
          <h3
            className="text-[15px] font-sans font-semibold leading-snug"
            style={{ color: "var(--foreground)" }}
          >
            {name}
          </h3>
        </div>

        {/* Score box */}
        <div
          className="shrink-0 w-11 h-11 flex items-center justify-center"
          style={{
            border: `1px solid ${color}40`,
            background: track,
          }}
        >
          <span className="text-[14px] font-mono tabular-nums leading-none font-bold" style={{ color }}>
            {visual_score}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-px" style={{ background: "var(--border-subtle)" }}>
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${visual_score}%`, background: color }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-px"
          style={{ width: 1, height: 5, background: "var(--border)", marginTop: -2.5 }}
        />
      </div>

      {/* Summary */}
      <p
        className="text-[12px] font-mono leading-[1.7]"
        style={{ color: "var(--foreground-muted)" }}
      >
        {summary}
      </p>

      {/* Evidence */}
      {evidenceEntries.length > 0 && (
        <div
          className="flex flex-col gap-2 pt-3.5 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {evidenceEntries.map(([k, v]) => {
            const formatted = formatEvidenceValue(k, v);
            if (!formatted) return null;
            return (
              <EvidenceRow key={k} label={formatEvidenceKey(k)} value={formatted} />
            );
          })}
        </div>
      )}

      {/* Calc hint */}
      <p
        className="text-[11px] font-mono leading-relaxed pt-3.5 border-t mt-auto"
        style={{ color: "var(--foreground-faint)", borderColor: "var(--border-subtle)" }}
      >
        {calc_hint}
      </p>
    </div>
  );
}
