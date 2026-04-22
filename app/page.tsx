"use client";

import { useEffect, useState } from "react";
import { fetchLatestAssetState, fetchMarketOverview, type MarketOverview, type DecisionAsset } from "@/lib/supabase/data";
import { HeaderBar, type ActiveView } from "@/components/narralytica/header-bar";
import { FearGreedModule } from "@/components/narralytica/fear-greed-module";
import { EtfFlowModule } from "@/components/narralytica/etf-flow-module";
import { OpenInterestModule } from "@/components/narralytica/open-interest-module";
import { SectorTable } from "@/components/narralytica/sector-table";
import { SpotlightList } from "@/components/narralytica/spotlight-list";
import { DecisionHeader } from "@/components/narralytica/decision-header";
import { ComponentScoreCard } from "@/components/narralytica/component-score-card";
import { PriceChart } from "@/components/narralytica/price-chart";

const B = "var(--border-subtle)";

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 py-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded"
          style={{
            background: "var(--surface-2)",
            width: `${60 + (i % 3) * 15}%`,
          }}
        />
      ))}
    </div>
  );
}

function SectionLabel({ eyebrow, title, meta }: { eyebrow: string; title?: string; meta?: string }) {
  return (
    <div
      className="px-6 py-4 flex items-center gap-3 border-b"
      style={{ background: "var(--surface)", borderColor: B }}
    >
      <span
        className="text-[12px] font-mono uppercase tracking-[0.22em] font-bold"
        style={{ color: "var(--foreground-dim)" }}
      >
        {eyebrow}
      </span>
      {title && (
        <>
          <span style={{ color: "var(--border)" }} className="text-[12px] font-mono">/</span>
          <span
            className="text-[12px] font-mono uppercase tracking-[0.14em] px-2 py-1 font-bold"
            style={{
              color: "var(--accent)",
              background: "var(--accent-track)",
              border: "1px solid var(--accent-track)",
            }}
          >
            {title}
          </span>
        </>
      )}
      {meta && (
        <span className="ml-auto text-[12px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground-faint)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

export default function Page() {
  const [activeAsset, setActiveAsset] = useState<string>("BTC");
  const [activeView, setActiveView]   = useState<ActiveView>("decision");
  const [decisions, setDecisions] = useState<DecisionAsset[] | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);

  // Get list of available assets from decisions
  const availableAssets = decisions?.map((d) => d.asset) ?? [];

  useEffect(() => {
    const fetchData = () => {
      Promise.all([fetchLatestAssetState(), fetchMarketOverview()]).then(([rows, overview]) => {
        if (rows.length > 0) {
          setDecisions(rows);
          // Auto-select first asset if current selection is not in the list
          if (!rows.find(r => r.asset === activeAsset)) {
            setActiveAsset(rows[0].asset);
          }
        }
        if (overview) setMarketOverview(overview);
      });
    };

    fetchData();

    // Refetch every 3 seconds
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [activeAsset]);

  const decisionData = decisions?.find((d) => d.asset === activeAsset) ?? decisions?.[0];
  const updatedAt = activeView === "decision" ? decisionData?.updated_at : marketOverview?.updated_at;

  return (
    <div className="w-full min-w-0 min-h-screen overflow-x-hidden" style={{ background: "var(--background)" }}>
      <HeaderBar
        updatedAt={updatedAt}
        activeAsset={activeAsset}
        onAssetChange={setActiveAsset}
        activeView={activeView}
        onViewChange={setActiveView}
        assets={availableAssets}
      />

      {activeView === "decision" ? (
        /* ════════════════ DECISION VIEW ════════════════ */
        <div>
          {/* Chart + Decision side-by-side */}
          <div
            className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] border-b"
            style={{ borderColor: B }}
          >
            {/* Chart panel */}
            <div
              className="border-b xl:border-b-0 xl:border-r"
              style={{ borderColor: B, background: "var(--background)" }}
            >
              <SectionLabel
                eyebrow={`${activeAsset} / USDC`}
                title="5m Chart"
                meta="Last 100 candles"
              />
              <PriceChart asset={activeAsset} />
            </div>

            {/* Decision panel */}
            <div style={{ background: "var(--surface)" }}>
              {decisionData
                ? <DecisionHeader data={decisionData} />
                : <Skeleton lines={6} />}
            </div>
          </div>

          {/* Why / Signal Alignment / Invalidations — full width below chart */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 border-b"
            style={{ borderColor: B }}
          >
            {/* Why */}
            <div className="px-6 py-6 border-b md:border-b-0 md:border-r" style={{ borderColor: B }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-4 font-bold" style={{ color: "var(--foreground-dim)" }}>
                Why
              </p>
              {!decisionData ? <Skeleton lines={2} /> : <div className="flex flex-wrap gap-2">
                {decisionData.signal_story.why.map((reason, i) => (
                  <span
                    key={i}
                    className="text-[12px] font-mono px-2.5 py-1 font-semibold"
                    style={{
                      color: "var(--foreground-muted)",
                      background: "var(--surface-2)",
                      border: `1px solid ${B}`,
                    }}
                  >
                    {reason}
                  </span>
                ))}
              </div>}
            </div>

            {/* Signal Alignment */}
            <div className="px-6 py-6 border-b md:border-b-0 md:border-r" style={{ borderColor: B }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-4 font-bold" style={{ color: "var(--foreground-dim)" }}>
                Signal Alignment
              </p>
              {!decisionData ? <Skeleton lines={3} /> : <div className="flex flex-col gap-4">
                {decisionData.signal_story.evidence.supporting_components.length > 0 && (
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2 font-bold" style={{ color: "var(--bull-dim)" }}>
                      Supporting
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {decisionData.signal_story.evidence.supporting_components.map((c) => (
                        <span key={c} className="text-[11px] font-mono px-2.5 py-1 font-semibold"
                          style={{ color: "var(--bull)", background: "var(--bull-track)", border: "1px solid var(--bull-track)" }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {decisionData.signal_story.evidence.opposing_components.length > 0 && (
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2 font-bold" style={{ color: "var(--bear-dim)" }}>
                      Opposing
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {decisionData.signal_story.evidence.opposing_components.map((c) => (
                        <span key={c} className="text-[11px] font-mono px-2.5 py-1 font-semibold"
                          style={{ color: "var(--bear)", background: "var(--bear-track)", border: "1px solid var(--bear-track)" }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>}
            </div>

            {/* Invalidations */}
            <div className="px-6 py-6" style={{ borderColor: B }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-4 font-bold" style={{ color: "var(--foreground-dim)" }}>
                Invalidations
              </p>
              {!decisionData ? <Skeleton lines={3} /> : <ul className="flex flex-col gap-3">
                {decisionData.signal_story.invalidations.map((inv, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="font-mono text-[11px] mt-0.5 shrink-0 tabular-nums font-bold" style={{ color: "var(--foreground-faint)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                      {inv}
                    </span>
                  </li>
                ))}
              </ul>}
            </div>
          </div>

          {/* Component breakdown */}
          <div className="border-b" style={{ borderColor: B }}>
            <SectionLabel
              eyebrow="Component Breakdown"
              title={activeAsset}
              meta={decisionData ? `${decisionData.signal_story.component_cards.length} signals` : ""}
            />
            {!decisionData ? <div className="px-6 py-6"><Skeleton lines={4} /></div> :
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {decisionData.signal_story.component_cards.map((card, i) => (
                <div
                  key={card.name}
                  style={{
                    borderRight:
                      (i + 1) % 4 !== 0 ? `1px solid ${B}` : undefined,
                  }}
                  className="[&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(4n)]:border-r-0 lg:border-r"
                >
                  <ComponentScoreCard card={card} />
                </div>
              ))}
            </div>}
          </div>

          {/* Metric Weighting Hierarchy */}
          <div className="border-b" style={{ borderColor: B }}>
            <div className="px-6 py-4" style={{ background: "var(--surface)" }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3 font-bold" style={{ color: "var(--foreground-dim)" }}>
                Metric Hierarchy · Signal Weighting
              </p>
              <div className="flex h-8 rounded overflow-hidden gap-px" style={{ gap: "0px" }}>
                {[
                  { name: "ETF Trend", weight: 20, color: "#22c55e" },
                  { name: "Price Confirm", weight: 18, color: "#10b981" },
                  { name: "Futures OI", weight: 16, color: "#14b8a6" },
                  { name: "Depth", weight: 14, color: "#06b6d4" },
                  { name: "Positioning", weight: 12, color: "#0ea5e9" },
                  { name: "Funding", weight: 10, color: "#3b82f6" },
                  { name: "Breadth", weight: 6, color: "#6366f1" },
                  { name: "Fear & Greed", weight: 4, color: "#8b5cf6" },
                ].map((metric) => (
                  <div
                    key={metric.name}
                    className="group relative transition-opacity hover:opacity-80 cursor-help"
                    style={{
                      flex: metric.weight,
                      background: metric.color,
                      height: "100%",
                    }}
                    title={`${metric.name} · ${metric.weight}%`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-[9px] font-mono flex-wrap" style={{ color: "var(--foreground-faint)" }}>
                {[
                  { name: "ETF Trend", color: "#22c55e" },
                  { name: "Price", color: "#10b981" },
                  { name: "OI", color: "#14b8a6" },
                  { name: "Depth", color: "#06b6d4" },
                  { name: "Position", color: "#0ea5e9" },
                  { name: "Funding", color: "#3b82f6" },
                  { name: "Breadth", color: "#6366f1" },
                  { name: "Fear/Greed", color: "#8b5cf6" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: `1px solid ${B}` }}
          >
            <span
              className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold"
              style={{ color: "var(--foreground-faint)" }}
            >
              Narralytica · Decision Layer
            </span>
            <span className="text-[11px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground-faint)" }}>
              {activeAsset}{decisionData?.reference_price_date ? ` · ref ${decisionData.reference_price_date}` : ""}
            </span>
          </footer>
        </div>
      ) : (
        /* ════════════════ CONTEXT VIEW ════════════════ */
        <div>
          {/* Full-width chart */}
          <div className="border-b" style={{ borderColor: B }}>
            <SectionLabel
              eyebrow={`${activeAsset} / USDC`}
              title="5m Chart"
              meta="Supporting Context"
            />
            <PriceChart asset={activeAsset} />
          </div>

          {/* 4 context modules */}
          <div className="border-b" style={{ borderColor: B }}>
            <SectionLabel eyebrow="Market Overlays" title="Context" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x" style={{ "--tw-divide-opacity": 1, borderColor: B } as React.CSSProperties}>
              <div className="px-6 py-6" style={{ borderColor: B, borderRight: `1px solid ${B}` }}>
                {marketOverview?.fear_greed ? <FearGreedModule data={marketOverview.fear_greed} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6" style={{ borderRight: `1px solid ${B}` }}>
                {marketOverview?.etf_metrics?.btc ? <EtfFlowModule asset="BTC" data={marketOverview.etf_metrics.btc} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6" style={{ borderRight: `1px solid ${B}` }}>
                {marketOverview?.etf_metrics?.eth ? <EtfFlowModule asset="ETH" data={marketOverview.etf_metrics.eth} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6">
                {marketOverview?.futures_open_interest ? <OpenInterestModule data={marketOverview.futures_open_interest} /> : <Skeleton lines={4} />}
              </div>
            </div>
          </div>

          {/* Sector + Spotlight */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 border-b"
            style={{ borderColor: B }}
          >
            {/* Sector */}
            <div className="border-b lg:border-b-0 lg:border-r" style={{ borderColor: B }}>
              <SectionLabel eyebrow="Market Structure" title="Sector Breadth" />
              <div className="px-6 py-6">
                {marketOverview?.sector_spotlight?.sector ? <SectorTable sectors={marketOverview.sector_spotlight.sector} /> : <Skeleton lines={4} />}
              </div>
            </div>

            {/* Spotlight */}
            <div>
              <SectionLabel eyebrow="Narrative Flow" title="Spotlight Rotations" />
              <div className="px-6 py-6">
                {marketOverview?.sector_spotlight?.spotlight ? <SpotlightList spotlight={marketOverview.sector_spotlight.spotlight} /> : <Skeleton lines={4} />}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: `1px solid ${B}` }}
          >
            <span
              className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold"
              style={{ color: "var(--foreground-faint)" }}
            >
              Narralytica · Market Context Layer
            </span>
            <span className="text-[11px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground-faint)" }}>
              {marketOverview?.updated_at ? new Date(marketOverview.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }) : "—"}
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
