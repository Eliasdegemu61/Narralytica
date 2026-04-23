"use client";

import { useEffect, useRef, useState } from "react";

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
  activeAsset: string;
  onAssetChange: (asset: string) => void;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  proMode: boolean;
  onProModeChange: (value: boolean) => void;
  assets?: string[];
}

export function HeaderBar({
  activeAsset,
  onAssetChange,
  activeView,
  onViewChange,
  proMode,
  onProModeChange,
  assets = ["BTC", "ETH"],
}: HeaderBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const primaryAssets = ["BTC", "ETH"].filter((asset) => assets.includes(asset));
  const extraAssets = assets.filter((asset) => !primaryAssets.includes(asset));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 flex min-w-0 w-full flex-col border-b md:h-14 md:flex-row md:items-stretch"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
    >
      {/* Wordmark */}
      <div
        className="flex h-14 items-center border-b px-4 shrink-0 md:border-b-0 md:border-r md:px-6"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span className="font-mono text-[13px] tracking-[0.28em] uppercase select-none font-bold" style={{ color: "var(--foreground)" }}>
          Narralytica
        </span>
      </div>

      {/* View tabs */}
      <div className="order-3 flex w-full items-stretch border-t md:order-none md:w-[380px] md:shrink-0 md:border-t-0" style={{ borderColor: "var(--border-subtle)" }}>
        {(["decision", "context", "relationship"] as ActiveView[]).map((v) => {
          const active = activeView === v;
          const hidden = !proMode && v !== "decision";
          return (
            <button
              key={v}
              onClick={() => !hidden && onViewChange(v)}
              disabled={hidden}
              className="relative flex flex-1 items-center justify-center px-3 py-3 text-[11px] font-mono uppercase tracking-[0.14em] border-r font-semibold transition-colors disabled:cursor-default whitespace-nowrap md:px-6 md:text-[12px]"
              style={{
                borderColor: "var(--border-subtle)",
                color: hidden
                  ? "transparent"
                  : active
                    ? "var(--foreground)"
                    : "var(--foreground-dim)",
                background: active && !hidden ? "var(--surface-2)" : "transparent",
              }}
              aria-hidden={hidden}
              tabIndex={hidden ? -1 : 0}
            >
              <span style={{ visibility: hidden ? "hidden" : "visible" }}>{v}</span>
              {active && !hidden && (
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
      <div className="hidden min-w-0 flex-1 md:block" />

      {/* Right cluster */}
      <div className="order-2 flex items-stretch justify-between md:order-none">
        <button
          type="button"
          onClick={() => onProModeChange(!proMode)}
          className="flex h-14 items-center gap-3 px-4 font-mono shrink-0 md:border-l md:px-5"
          style={{ borderColor: "var(--border-subtle)" }}
          aria-pressed={proMode}
          title={`Pro Mode ${proMode ? "On" : "Off"}`}
        >
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold whitespace-nowrap" style={{ color: proMode ? "var(--foreground)" : "var(--foreground-dim)" }}>
            Pro Mode
          </span>
          <span
            className="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors overflow-hidden"
            style={{
              background: "#050505",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="absolute top-[2px] h-5 w-5 rounded-full transition-all"
              style={{
                left: proMode ? "18px" : "2px",
                background: proMode ? "var(--bull)" : "#ffffff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              }}
            />
          </span>
        </button>

        {/* Asset toggle */}
        <div className="flex min-w-0 items-stretch overflow-x-auto md:overflow-visible">
          {primaryAssets.map((a) => {
            const active = activeAsset === a;
            const logoUrl = ASSET_LOGOS[a] || ASSET_LOGOS.BTC;
            return (
              <button
                key={a}
                onClick={() => onAssetChange(a)}
                className="relative flex h-14 shrink-0 items-center gap-2 px-3 font-semibold transition-colors md:px-4"
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

          {extraAssets.length > 0 && (
            <div
              ref={moreRef}
              className="relative flex items-stretch border-l shrink-0"
              style={{ borderColor: "var(--border-subtle)" }}
              onMouseEnter={() => setMoreOpen(true)}
              onMouseLeave={() => setMoreOpen(false)}
            >
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                className="relative px-4 h-full font-semibold transition-colors flex items-center gap-2 shrink-0"
                style={{
                  color: extraAssets.includes(activeAsset) ? "var(--foreground)" : "var(--foreground-dim)",
                  background: extraAssets.includes(activeAsset) ? "var(--surface-2)" : "transparent",
                }}
              >
                <span className="text-[12px] font-mono uppercase tracking-[0.14em] whitespace-nowrap">More</span>
                <span className="text-[10px]" style={{ color: "var(--foreground-faint)" }}>▾</span>
                {extraAssets.includes(activeAsset) && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </button>

              <div
                className="absolute right-0 top-full z-50 min-w-[190px] border shadow-2xl"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border-subtle)",
                  display: moreOpen ? "block" : "none",
                }}
              >
                {extraAssets.map((a) => {
                  const active = activeAsset === a;
                  const logoUrl = ASSET_LOGOS[a] || ASSET_LOGOS.BTC;
                  return (
                    <button
                      key={a}
                      onClick={() => {
                        onAssetChange(a);
                        setMoreOpen(false);
                      }}
                      className="flex w-full items-center gap-2 border-b px-4 py-3 font-semibold transition-colors last:border-b-0"
                      style={{
                        borderColor: "var(--border-subtle)",
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
