import {
  clampScore,
  getFearGreedInterpretation,
  getFearGreedLabel,
} from "@/lib/format";

interface FearGreedData {
  latest: { "crypto_fear_&_greed_index": number };
  previous: { "crypto_fear_&_greed_index": number };
  series: { timestamp: string; "crypto_fear_&_greed_index": number }[];
}

interface FearGreedModuleProps {
  data: FearGreedData;
}

// Zone config — tight monochrome scale with accent at extremes
const BANDS = [
  { label: "Extreme Fear", color: "#3d0f0f", end: 20 },
  { label: "Fear",         color: "#4a1a0e", end: 40 },
  { label: "Neutral",      color: "#1c1c1c", end: 60 },
  { label: "Greed",        color: "#0c2a18", end: 80 },
  { label: "Extreme Greed",color: "#103522", end: 100 },
];

export function FearGreedModule({ data }: FearGreedModuleProps) {
  const score = clampScore(data.latest["crypto_fear_&_greed_index"]);
  const prev  = clampScore(data.previous["crypto_fear_&_greed_index"]);
  const delta = score - prev;
  const label = getFearGreedLabel(score);
  const interpretation = getFearGreedInterpretation(score);

  const deltaColor =
    delta > 0 ? "var(--bull)" : delta < 0 ? "var(--bear)" : "var(--neutral-fg)";

  return (
    <div className="flex flex-col gap-4">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold"
        style={{ color: "var(--foreground-dim)" }}
      >
        Fear &amp; Greed · Sentiment
      </p>

      {/* Big number */}
      <div className="flex items-baseline gap-3">
        <span
          className="text-[48px] font-mono leading-none tabular-nums"
          style={{ color: "var(--foreground)" }}
        >
          {score}
        </span>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[12px] font-mono uppercase tracking-wide"
            style={{ color: "var(--foreground-muted)" }}
          >
            {label}
          </span>
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: deltaColor }}
          >
            {delta > 0 ? "+" : ""}{delta} vs prior
          </span>
        </div>
      </div>

      {/* Scale bar */}
      <div className="relative">
        <div className="flex h-[3px] w-full overflow-hidden">
          {BANDS.map((band, i) => {
            const start = i === 0 ? 0 : BANDS[i - 1].end;
            return (
              <div
                key={band.label}
                style={{ width: `${band.end - start}%`, backgroundColor: band.color }}
              />
            );
          })}
        </div>
        {/* Cursor */}
        <div
          className="absolute -translate-x-1/2"
          style={{
            left: `${score}%`,
            top: -2,
            width: 2,
            height: 7,
            background: "var(--foreground)",
          }}
        />
      </div>

      <div className="flex justify-between -mt-1">
        <span
          className="text-[11px] font-mono uppercase tracking-[0.1em] font-semibold"
          style={{ color: "var(--foreground-dim)" }}
        >
          Fear
        </span>
        <span
          className="text-[11px] font-mono uppercase tracking-[0.1em] font-semibold"
          style={{ color: "var(--foreground-dim)" }}
        >
          Greed
        </span>
      </div>

      <p
        className="text-[11px] font-mono leading-[1.65] pt-3 border-t"
        style={{ color: "var(--foreground-muted)", borderColor: "var(--border-subtle)" }}
      >
        {interpretation}
      </p>
    </div>
  );
}
