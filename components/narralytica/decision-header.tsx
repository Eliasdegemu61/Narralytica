import { formatPrice } from "@/lib/format";
import type { DecisionAsset } from "@/lib/mock-data";

const SIGNAL_COLOR: Record<string, string> = {
  bullish: "var(--bull)",
  bearish: "var(--bear)",
  neutral: "var(--neutral-fg)",
};
const SIGNAL_TRACK: Record<string, string> = {
  bullish: "var(--bull-track)",
  bearish: "var(--bear-track)",
  neutral: "var(--border-subtle)",
};

function DataPair({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-mono uppercase tracking-[0.16em] font-semibold"
        style={{ color: "var(--foreground-dim)" }}
      >
        {label}
      </span>
      <span
        className="text-[15px] font-mono uppercase tracking-wide font-bold"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}

interface DecisionHeaderProps {
  data: DecisionAsset;
}

export function DecisionHeader({ data }: DecisionHeaderProps) {
  const { signal_story, overall_signal, reference_price, reference_price_date } = data;
  const { headline, decision_summary } = signal_story;
  const sigColor = SIGNAL_COLOR[overall_signal] ?? "var(--neutral-fg)";
  const sigTrack = SIGNAL_TRACK[overall_signal] ?? "var(--border-subtle)";

  return (
    <div className="flex flex-col" style={{ borderColor: "var(--border-subtle)" }}>

      {/* ── SIGNAL BADGE STRIP ── */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ background: "var(--surface-2)", borderColor: "var(--border-subtle)" }}
      >
        <span
          className="text-[11px] font-mono uppercase tracking-[0.22em] px-2.5 py-1 font-bold"
          style={{ color: sigColor, background: sigTrack, border: `1px solid ${sigColor}20` }}
        >
          {overall_signal}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold" style={{ color: "var(--foreground-dim)" }}>
          Decision Layer
        </span>

      </div>

      {/* ── HERO: Headline + Price ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_300px] border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {/* Headline */}
        <div className="px-6 py-8 border-r" style={{ borderColor: "var(--border-subtle)" }}>
          <h2
            className="text-[32px] font-sans font-light tracking-tight leading-tight mb-5 text-balance"
            style={{ color: "var(--foreground)" }}
          >
            {headline.title}
          </h2>
          <p className="text-[14px] font-mono leading-[1.8] max-w-lg" style={{ color: "var(--foreground-muted)" }}>
            {headline.summary}
          </p>
        </div>

        {/* Reference price */}
        <div className="px-6 py-8 flex flex-col gap-7">
          <div>
            <p
              className="text-[11px] font-mono uppercase tracking-[0.16em] mb-2 font-bold"
              style={{ color: "var(--foreground-dim)" }}
            >
              Reference Price
            </p>
            <p
              className="text-[40px] font-mono leading-none tabular-nums font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {formatPrice(reference_price)}
            </p>
            <p className="text-[11px] font-mono mt-2.5 tabular-nums font-semibold" style={{ color: "var(--foreground-dim)" }}>
              {reference_price_date}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 pt-5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <DataPair label="Action" value={decision_summary.action} color={sigColor} />
            <DataPair label="Bias" value={decision_summary.market_bias} />
            <DataPair label="Conviction" value={decision_summary.conviction} />
            <DataPair label="Size" value={decision_summary.position_size_bucket} />
          </div>
        </div>
      </div>

    </div>
  );
}
