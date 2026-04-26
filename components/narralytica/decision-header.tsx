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
const ASSET_LOGOS: Record<string, string> = {
  BTC: "https://static.sosovalue.com/sosponge/droplist/23/06/13/k5xwt0j0fw1z.png",
  ETH: "https://static.sosovalue.com/sosponge/droplist/23/06/13/jhgqt0j0fwmv.png",
  SOL: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
  XRP: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",
  ADA: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png",
  DOGE: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png",
  AVAX: "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png",
  LINK: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png",
  HBAR: "https://s2.coinmarketcap.com/static/img/coins/64x64/4642.png",
  SUI: "https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png",
  BNB: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png",
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

function actionDisplay(action: string) {
  switch (action) {
    case "perps_long":
      return "LONG";
    case "perps_short":
      return "SHORT";
    case "spot_long":
      return "SPOT LONG";
    default:
      return "WAIT";
  }
}

interface DecisionHeaderProps {
  data: DecisionAsset;
  livePrice?: number | null;
}

export function DecisionHeader({ data, livePrice = null }: DecisionHeaderProps) {
  const { signal_story, overall_signal, reference_price, reference_price_date } = data;
  const displayPrice = livePrice && livePrice > 0 ? livePrice : reference_price;
  const priceLabel = livePrice && livePrice > 0 ? "Live Price" : "Reference Price";
  const { headline, decision_summary } = signal_story;
  const sigColor = SIGNAL_COLOR[overall_signal] ?? "var(--neutral-fg)";
  const sigTrack = SIGNAL_TRACK[overall_signal] ?? "var(--border-subtle)";
  const actionOptions = ["LONG", "SHORT", "WAIT", "SPOT LONG"];
  const activeAction = actionDisplay(decision_summary.action);
  const logoUrl = ASSET_LOGOS[data.asset] ?? ASSET_LOGOS.BTC;

  return (
    <div className="flex flex-col" style={{ borderColor: "var(--border-subtle)" }}>

      {/* ── SIGNAL BADGE STRIP ── */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b sm:px-6"
        style={{ background: "rgba(10,10,10,0.58)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
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
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Headline */}
        <div className="px-4 py-7 sm:px-6 sm:py-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {actionOptions.map((option) => {
              const active = option === activeAction;
              return (
                <span
                  key={option}
                  className="border-b pb-1 text-[12px] font-mono uppercase tracking-[0.16em] font-semibold"
                  style={{
                    color: active ? "var(--foreground)" : "var(--foreground)",
                    fontWeight: active ? 800 : 600,
                    opacity: active ? 1 : 0.78,
                    borderColor: active ? sigColor : "var(--bear-dim)",
                  }}
                >
                  {option}
                </span>
              );
            })}
          </div>
          <div className="mb-5 flex items-center gap-3">
            <img
              src={logoUrl}
              alt={data.asset}
              className="h-8 w-8 rounded-full shrink-0 sm:h-9 sm:w-9"
              crossOrigin="anonymous"
            />
            <h2
              className="text-[28px] font-sans font-light tracking-tight leading-tight text-balance sm:text-[32px]"
              style={{ color: "var(--foreground)" }}
            >
              {headline.title}
            </h2>
          </div>
          <p className="text-[14px] font-mono leading-[1.8] max-w-lg" style={{ color: "var(--foreground-muted)" }}>
            {headline.summary}
          </p>
        </div>

        {/* Reference price */}
        <div
          className="flex flex-col gap-7 border-t px-4 py-7 sm:px-6 sm:py-8 lg:border-t-0"
          style={{
            background: "rgba(10,10,10,0.12)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
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

