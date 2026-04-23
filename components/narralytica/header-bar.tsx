"use client";

import { formatUpdatedAt } from "@/lib/format";

export type ActiveView = "decision" | "context" | "relationship";

// Asset logo mapping
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

interface HeaderBarProps {
  updatedAt?: string;
  activeAsset: string;
  onAssetChange: (asset: string) => void;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  assets?: string[];
}

export function HeaderBar({
  updatedAt,
  activeAsset,
  onAssetChange,
  activeView,
  onViewChange,
  assets = ["BTC", "ETH"],
}: HeaderBarProps) {
  return (
    <header
      className="flex items-stretch h-14 border-b sticky top-0 z-50 min-w-0 w-full"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
    >
      {/* Wordmark */}
      <div
        className="flex items-center px-6 border-r shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span className="font-mono text-[13px] tracking-[0.28em] uppercase select-none font-bold" style={{ color: "var(--foreground)" }}>
          Narralytica
        </span>
      </div>

      {/* View tabs */}
      <div className="flex items-stretch">
        {(["decision", "context", "relationship"] as ActiveView[]).map((v) => {
          const active = activeView === v;
          return (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="relative flex items-center px-6 text-[12px] font-mono uppercase tracking-[0.14em] border-r font-semibold transition-colors"
              style={{
                borderColor: "var(--border-subtle)",
                color: active ? "var(--foreground)" : "var(--foreground-dim)",
                background: active ? "var(--surface-2)" : "transparent",
              }}
            >
              {v}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Right cluster */}
      <div className="flex items-stretch">
        {/* Live pulse */}
        <div
          className="flex items-center gap-2.5 px-5 border-l"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="relative flex h-[7px] w-[7px] shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
              style={{ background: "var(--bull)" }}
            />
            <span
              className="relative inline-flex rounded-full h-[7px] w-[7px]"
              style={{ background: "var(--bull)" }}
            />
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] hidden sm:block font-semibold" style={{ color: "var(--foreground-dim)" }}>
            Live
          </span>
        </div>

        {/* Timestamp */}
        <div
          className="hidden sm:flex items-center px-5 border-l"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="text-[12px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground-dim)" }}>
            {formatUpdatedAt(updatedAt)}
          </span>
        </div>

        {/* Asset toggle — scrollable if many */}
        <div className="flex items-stretch overflow-x-auto no-scrollbar max-w-[400px] lg:max-w-[600px] xl:max-w-none">
          {assets.map((a) => {
            const active = activeAsset === a;
            const logoUrl = ASSET_LOGOS[a] || ASSET_LOGOS.BTC;
            return (
              <button
                key={a}
                onClick={() => onAssetChange(a)}
                className="relative px-4 h-full font-semibold transition-colors flex items-center gap-2 shrink-0"
                style={{
                  borderColor: "var(--border-subtle)",
                  borderLeft: `1px solid var(--border-subtle)`,
                  color: active ? "var(--foreground)" : "var(--foreground-dim)",
                  background: active ? "var(--surface-2)" : "transparent",
                }}
              >
                <img 
                  src={logoUrl} 
                  alt={a} 
                  className="w-5 h-5 rounded-full"
                  crossOrigin="anonymous"
                />
                <span className="text-[12px] font-mono uppercase tracking-[0.14em]">{a}</span>
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
