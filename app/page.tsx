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
import { RelationshipModule } from "@/components/narralytica/relationship-module";
import { formatPrice } from "@/lib/format";

const B = "var(--border-subtle)";

const TRADE_KLINE_CONFIG: Partial<Record<string, { base: string; hasStartTime: boolean }>> = {
  BTC:  { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=BTC-USD", hasStartTime: true },
  ETH:  { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=ETH-USD", hasStartTime: true },
  DOGE: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vDOGE_vUSDC", hasStartTime: true },
  ADA:  { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vADA_vUSDC", hasStartTime: true },
  SOL:  { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vSOL_vUSDC", hasStartTime: true },
  SUI:  { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vSUI_vUSDC", hasStartTime: false },
  BNB:  { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vBNB_vUSDC", hasStartTime: true },
  LINK: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vLINK_vUSDC", hasStartTime: false },
  XRP:  { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vXRP_vUSDC", hasStartTime: true },
  AVAX: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=vAVAX_vUSDC", hasStartTime: false },
  HBAR: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=HBAR-USD", hasStartTime: false },
};

type RadarMetric = {
  name: string;
  short: string;
  value: number;
};

function signalColor(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  const hue = (clamped / 100) * 120;
  return `hsl(${hue} 78% 52%)`;
}

function splitRadarLabel(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
}

function extractChangePercent(data: DecisionAsset): number | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [data.signal_story?.evidence?.raw_data_used];
  const keys = new Set([
    "change_pct_24h",
    "changePercent24h",
    "price_change_percent_24h",
    "priceChangePercent24h",
    "pct_change_24h",
    "percent_change_24h",
  ]);

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (keys.has(key) && typeof value === "number" && Number.isFinite(value)) {
        return Math.abs(value) > 1 ? value / 100 : value;
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function actionLabel(action: string) {
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

function actionMarket(action: string) {
  switch (action) {
    case "perps_long":
    case "perps_short":
      return "Perps";
    case "spot_long":
      return "Spot";
    default:
      return "None";
  }
}

function tradeTargetPercent(action: string) {
  switch (action) {
    case "perps_long":
    case "spot_long":
      return 0.001;
    case "perps_short":
      return -0.001;
    default:
      return 0;
  }
}

function tradeFeeRate(action: string) {
  return action === "spot_long" ? 0.002 : action === "wait" ? 0 : 0.00024;
}

function tradeLeverage(action: string) {
  return action === "perps_long" || action === "perps_short" ? 5 : 1;
}

function tradeSizeUsd(bucket: string) {
  switch (bucket) {
    case "large":
      return 50;
    case "medium":
      return 20;
    default:
      return 10;
  }
}

function formatUsdCompact(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })}`;
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function getTradeKlineUrl(asset: string) {
  const config = TRADE_KLINE_CONFIG[asset];
  if (!config) return null;
  const now = Date.now();
  let url = `${config.base}&interval=5m&limit=2&endTime=${now}`;
  if (config.hasStartTime) {
    url += `&startTime=${now - 2 * 5 * 60 * 1000}`;
  }
  return url;
}

function TestTradeCard({
  data,
  onClose,
  livePrice,
  amountUsd,
  onAmountChange,
}: {
  data: DecisionAsset;
  onClose: () => void;
  livePrice: number;
  amountUsd: number;
  onAmountChange: (value: number) => void;
}) {
  const decision = data.signal_story.decision_summary;
  const entry = livePrice;
  const targetMove = tradeTargetPercent(decision.action);
  const targetPrice = entry > 0 ? entry * (1 + targetMove) : 0;
  const sizeUsd = amountUsd;
  const leverage = tradeLeverage(decision.action);
  const feesRate = tradeFeeRate(decision.action);
  const notional = sizeUsd * leverage;
  const grossPnl = notional * Math.abs(targetMove);
  const fees = notional * feesRate;
  const netPnl = grossPnl - fees;
  const supportCount = data.signal_story.evidence.supporting_components.length;
  const totalSignals = Math.max(
    supportCount + data.signal_story.evidence.opposing_components.length,
    data.signal_output?.signal?.available_component_count ?? 0,
    1,
  );
  const downside = decision.conviction === "high" ? -0.002 : decision.conviction === "medium" ? -0.003 : -0.004;

  return (
    <>
      <button
        type="button"
        aria-label="Close trade tester"
        className="fixed inset-0 z-30 bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border p-4 shadow-2xl backdrop-blur-md sm:bottom-5 sm:right-5 sm:p-5"
        style={{
          borderColor: B,
          background: "rgba(10,10,10,0.92)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
            Test This Trade
          </p>
          <p className="mt-1 text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
            If you started this trade now, this is the live setup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="mr-1 rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] transition-colors"
            style={{
              borderColor: B,
              color: "var(--foreground-faint)",
              background: "transparent",
            }}
          >
            Close
          </button>
          <span
            className="inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--bull)" }}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-faint)" }}>
            Live
          </span>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
            style={{
              color: decision.action === "perps_short" ? "var(--bear)" : decision.action === "wait" ? "var(--foreground-faint)" : "var(--bull)",
              background: decision.action === "perps_short" ? "var(--bear-track)" : decision.action === "wait" ? "var(--surface-2)" : "var(--bull-track)",
            }}
          >
            {actionLabel(decision.action)}
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3">
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: B, background: "var(--background)" }}>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
            Trade Summary
          </p>
          <div className="grid grid-cols-1 gap-2 text-[12px] font-mono sm:grid-cols-2">
            <p style={{ color: "var(--foreground-muted)" }}>Pair: <span style={{ color: "var(--foreground)" }}>{data.asset}/USDC</span></p>
            <p style={{ color: "var(--foreground-muted)" }}>Market: <span style={{ color: "var(--foreground)" }}>{actionMarket(decision.action)}</span></p>
            <p style={{ color: "var(--foreground-muted)" }}>Entry: <span style={{ color: "var(--foreground)" }}>{formatPrice(entry)}</span></p>
            <p style={{ color: "var(--foreground-muted)" }}>Target: <span style={{ color: "var(--foreground)" }}>{formatPrice(targetPrice)} ({formatPct(targetMove)})</span></p>
            <label style={{ color: "var(--foreground-muted)" }}>
              Size:
              <input
                type="number"
                min={1}
                step={1}
                value={amountUsd}
                onChange={(event) => onAmountChange(Math.max(1, Number(event.target.value) || 1))}
                className="ml-2 w-20 border px-2 py-1 text-[12px] font-mono outline-none"
                style={{
                  borderColor: B,
                  background: "var(--surface)",
                  color: "var(--foreground)",
                }}
              />
            </label>
            <p style={{ color: "var(--foreground-muted)" }}>Leverage: <span style={{ color: "var(--foreground)" }}>{leverage}x</span></p>
          </div>
        </div>

        <div className="rounded-xl border px-4 py-3" style={{ borderColor: B, background: "var(--background)" }}>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
            Expected Outcome
          </p>
          <div className="space-y-2 text-[12px] font-mono">
            <p style={{ color: "var(--foreground-muted)" }}>Net: <span style={{ color: netPnl >= 0 ? "var(--bull)" : "var(--bear)" }}>{`${netPnl >= 0 ? "+" : ""}${formatUsdCompact(netPnl).replace("$", "$")}`}</span></p>
            <p style={{ color: "var(--foreground-muted)" }}>Move needed: <span style={{ color: "var(--foreground)" }}>{formatPct(Math.abs(targetMove))}</span></p>
            <p style={{ color: "var(--foreground-muted)" }}>Fees: <span style={{ color: "var(--foreground)" }}>{formatPct(feesRate)} round trip</span></p>
          </div>
        </div>

        <div className="rounded-xl border px-4 py-3" style={{ borderColor: B, background: "var(--background)" }}>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
            Setup Read
          </p>
          <div className="space-y-2 text-[12px] font-mono">
            <p style={{ color: "var(--foreground-muted)" }}>
              Supported by <span style={{ color: "var(--foreground)" }}>{supportCount}/{totalSignals}</span> live signals
            </p>
            <p style={{ color: "var(--foreground-muted)" }}>
              {decision.conviction === "high" ? "Strong" : decision.conviction === "medium" ? "Moderate" : "Cautious"} follow-through expected
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border px-4 py-3" style={{ borderColor: B, background: "var(--background)" }}>
        <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
          Risk Trigger
        </p>
        <p className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          If invalidated, expected downside could extend toward <span style={{ color: "var(--bear)" }}>{formatPct(downside)}</span>{data.signal_story.invalidations[0] ? ` · ${data.signal_story.invalidations[0]}` : ""}.
        </p>
      </div>
      </div>
    </>
  );
}

function SimpleDecisionView({ data, asset }: { data?: DecisionAsset; asset: string }) {
  if (!data) {
    return <div className="px-4 py-6 sm:px-6 sm:py-8"><Skeleton lines={8} /></div>;
  }

  const decision = data.signal_story.decision_summary;
  const evidence = data.signal_story.evidence;
  const supportingCount = evidence.supporting_components.length;
  const opposingCount = evidence.opposing_components.length;
  const changePct = extractChangePercent(data);
  const oneLineWhy = `${supportingCount > 0 ? `${evidence.supporting_components.slice(0, 2).join(" + ")} supportive` : "No strong support yet"}${opposingCount > 0 ? `, ${evidence.opposing_components[0]} slightly opposing` : ""}`;

  return (
    <div style={{ background: "var(--background)" }}>
      <div className="border-b" style={{ borderColor: B }}>
        <SectionLabel eyebrow="Simple Mode" title={asset} meta="Decision First" />

        <div className="grid grid-cols-1 border-b lg:grid-cols-[minmax(0,0.95fr)_320px]" style={{ borderColor: B }}>
          <div className="border-b lg:border-b-0 lg:border-r" style={{ borderColor: B, background: "var(--background)" }}>
            <div className="border-b px-4 py-3 sm:px-6" style={{ borderColor: B, background: "var(--surface)" }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                {asset} / USDC · 5m Chart
              </span>
            </div>
            <PriceChart asset={asset} />
          </div>

          <div className="px-4 py-5 sm:px-6 sm:py-6" style={{ borderColor: B, background: "var(--surface)" }}>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold mb-4" style={{ color: "var(--foreground-dim)" }}>
              Top
            </p>
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: "var(--foreground-faint)" }}>Price</p>
                <p className="text-[20px] font-mono font-bold leading-none sm:text-[28px]" style={{ color: "var(--foreground)" }}>
                  {formatPrice(data.reference_price ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: "var(--foreground-faint)" }}>Pair</p>
                <p className="text-[14px] font-mono font-bold sm:text-[18px]" style={{ color: "var(--foreground)" }}>
                  {asset} / USDC
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: "var(--foreground-faint)" }}>Change %</p>
                <p className="text-[14px] font-mono font-bold sm:text-[18px]" style={{ color: changePct == null ? "var(--foreground-faint)" : changePct >= 0 ? "var(--bull)" : "var(--bear)" }}>
                  {changePct == null ? "—" : `${changePct >= 0 ? "+" : ""}${(changePct * 100).toFixed(2)}%`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6 sm:py-8" style={{ background: "var(--background)" }}>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold mb-3" style={{ color: "var(--foreground-dim)" }}>
              Big Decision
            </p>
            <div className="mb-6">
              <p
                className="text-[28px] font-sans font-semibold leading-none tracking-tight sm:text-[34px] lg:text-[42px]"
                style={{
                  color:
                    decision.action === "perps_short"
                      ? "var(--bear)"
                      : decision.action === "wait"
                        ? "var(--foreground)"
                        : "var(--bull)",
                }}
              >
                {actionLabel(decision.action)}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Action", value: actionMarket(decision.action) },
                { label: "Conviction", value: decision.conviction },
                { label: "Size", value: decision.position_size_bucket },
                { label: "Bias", value: decision.market_bias },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border px-4 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: "var(--foreground-faint)" }}>
                    {item.label}
                  </p>
                  <p className="text-[15px] font-mono font-bold uppercase" style={{ color: "var(--foreground)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="max-w-3xl text-[13px] font-mono leading-[1.8] mb-6" style={{ color: "var(--foreground-muted)" }}>
              {oneLineWhy}
            </p>

            <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: B, background: "var(--surface)" }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold mb-4" style={{ color: "var(--foreground-dim)" }}>
                Signal Summary
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-[13px] font-mono font-bold" style={{ color: "var(--bull)" }}>
                  Supporting: {supportingCount}
                </span>
                <span className="text-[13px] font-mono font-bold" style={{ color: opposingCount > 0 ? "var(--bear)" : "var(--foreground-faint)" }}>
                  Opposing: {opposingCount}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {evidence.supporting_components.slice(0, 4).map((item) => (
                  <span
                    key={`s-${item}`}
                    className="px-2.5 py-1 text-[11px] font-mono font-semibold"
                    style={{ color: "var(--bull)", background: "var(--bull-track)", border: "1px solid var(--bull-track)" }}
                  >
                    {item}
                  </span>
                ))}
                {evidence.opposing_components.slice(0, 2).map((item) => (
                  <span
                    key={`o-${item}`}
                    className="px-2.5 py-1 text-[11px] font-mono font-semibold"
                    style={{ color: "var(--bear)", background: "var(--bear-track)", border: "1px solid var(--bear-track)" }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: B, background: "var(--surface)" }}>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold mb-4" style={{ color: "var(--foreground-dim)" }}>
                Invalidations
              </p>
              <div className="space-y-3">
                {data.signal_story.invalidations.slice(0, 2).map((item, idx) => (
                  <div key={item + idx} className="flex gap-3">
                    <span className="text-[11px] font-mono font-bold tabular-nums mt-0.5" style={{ color: "var(--foreground-faint)" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

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
      className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:gap-3 sm:px-6 sm:py-4"
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
        <span className="ml-auto text-[11px] font-mono tabular-nums font-semibold sm:text-[12px]" style={{ color: "var(--foreground-faint)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

function DecisionRadar({ data }: { data: DecisionAsset }) {
  const cards = data.signal_story.component_cards ?? [];
  const metrics: RadarMetric[] = cards.slice(0, 8).map((card, idx) => ({
    name: card.name,
    short: card.name.length > 10 ? card.name.slice(0, 10) : card.name,
    value: Math.max(0, Math.min(100, Number(card.visual_score ?? card.score ?? 0))),
  }));

  if (metrics.length === 0) return null;

  const size = 320;
  const center = size / 2;
  const radius = 112;
  const labelRadius = 142;
  const points = metrics.map((metric, idx) => {
    const angle = (-Math.PI / 2) + (idx / metrics.length) * Math.PI * 2;
    const value = metric.value;
    const scaled = (value / 100) * radius;
    return {
      x: center + Math.cos(angle) * scaled,
      y: center + Math.sin(angle) * scaled,
      lx: center + Math.cos(angle) * labelRadius,
      ly: center + Math.sin(angle) * labelRadius,
      angle,
      value,
      metric,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];
  const centerScore = Math.round(metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length);

  return (
    <div
      className="grid grid-cols-1 gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 xl:grid-cols-[360px_minmax(0,1fr)]"
      style={{ background: "var(--background)" }}
    >
      <div className="flex items-center justify-center">
        <div className="relative h-[260px] w-[260px] sm:h-[320px] sm:w-[320px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
            <defs>
              <radialGradient id="decision-radar-fill" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(34,197,94,0.22)" />
                <stop offset="100%" stopColor="rgba(34,197,94,0.04)" />
              </radialGradient>
              <filter id="decision-radar-glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {rings.map((ring) => (
              <circle
                key={ring}
                cx={center}
                cy={center}
                r={radius * ring}
                fill="none"
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="1"
              />
            ))}

            {points.map((point, idx) => (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={center + Math.cos(point.angle) * radius}
                y2={center + Math.sin(point.angle) * radius}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            ))}

            <polygon points={polygon} fill="url(#decision-radar-fill)" stroke="none" />
            <polygon
              points={polygon}
              fill="none"
              stroke="#34d399"
              strokeWidth="3"
              strokeLinejoin="round"
              filter="url(#decision-radar-glow)"
            />

            {points.map((point, idx) => (
              <g key={idx}>
                <circle cx={point.x} cy={point.y} r="4" fill="#34d399" />
                <text
                  x={point.lx}
                  y={point.ly - ((splitRadarLabel(point.metric.short).length - 1) * 7)}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.72)"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                >
                  {splitRadarLabel(point.metric.short).map((part, lineIdx) => (
                    <tspan key={part + lineIdx} x={point.lx} dy={lineIdx === 0 ? 0 : 14}>
                      {part}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}

            <circle cx={center} cy={center} r="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
            <text
              x={center}
              y={center - 2}
              textAnchor="middle"
              fill="white"
              fontSize="28"
              fontWeight="bold"
              fontFamily="var(--font-mono)"
            >
              {centerScore}
            </text>
            <text
              x={center}
              y={center + 18}
              textAnchor="middle"
              fill="rgba(255,255,255,0.55)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              score
            </text>
          </svg>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
            Signal Shape
          </p>
          <p className="mt-2 text-[13px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
            This radar shows the live signal components for {data.asset}. Bigger spokes mean that component is contributing more conviction right now.
            A balanced shape means broad confirmation, while dents show weak or missing support.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div
              key={metric.name}
              className="rounded-xl border px-3 py-3"
              style={{ borderColor: B, background: "var(--surface)" }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: signalColor(metric.value) }} />
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-dim)" }}>
                    {metric.short}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--foreground-faint)" }}>
                  {Math.round(metric.value)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${metric.value}%`,
                    background: signalColor(metric.value),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [activeAsset, setActiveAsset] = useState<string>("BTC");
  const [activeView, setActiveView] = useState<ActiveView>("decision");
  const [proMode, setProMode] = useState(true);
  const [showTradeTester, setShowTradeTester] = useState(false);
  const [tradeAmountUsd, setTradeAmountUsd] = useState(20);
  const [liveTradePrice, setLiveTradePrice] = useState<number | null>(null);
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

  useEffect(() => {
    if (!decisionData) return;
    setTradeAmountUsd(tradeSizeUsd(decisionData.signal_story.decision_summary.position_size_bucket));
  }, [activeAsset, decisionData?.signal_story.decision_summary.position_size_bucket]);

  useEffect(() => {
    let ignore = false;

    async function fetchLivePrice() {
      const url = getTradeKlineUrl(activeAsset);
      if (!url) {
        if (!ignore) setLiveTradePrice(decisionData?.reference_price ?? null);
        return;
      }

      try {
        const response = await fetch(url, { cache: "no-store" });
        const json = await response.json();
        const latest = Array.isArray(json?.data) ? json.data[json.data.length - 1] : null;
        const close = latest ? Number(latest.c ?? latest.close ?? 0) : 0;
        if (!ignore) {
          setLiveTradePrice(close > 0 ? close : (decisionData?.reference_price ?? null));
        }
      } catch {
        if (!ignore) {
          setLiveTradePrice(decisionData?.reference_price ?? null);
        }
      }
    }

    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 3000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [activeAsset, decisionData?.reference_price]);

  return (
    <div className="w-full min-w-0 min-h-screen overflow-x-hidden" style={{ background: "var(--background)" }}>
      <HeaderBar
        activeAsset={activeAsset}
        onAssetChange={setActiveAsset}
        activeView={activeView}
        onViewChange={setActiveView}
        proMode={proMode}
        onProModeChange={setProMode}
        assets={availableAssets}
      />

      {showTradeTester && decisionData ? (
        <TestTradeCard
          data={decisionData}
          livePrice={liveTradePrice ?? decisionData.reference_price ?? 0}
          amountUsd={tradeAmountUsd}
          onAmountChange={setTradeAmountUsd}
          onClose={() => setShowTradeTester(false)}
        />
      ) : null}

      {!showTradeTester && decisionData ? (
        <button
          type="button"
          onClick={() => setShowTradeTester(true)}
          className="fixed bottom-4 right-4 z-30 rounded-full border px-4 py-3 text-[11px] font-mono uppercase tracking-[0.16em] font-bold shadow-2xl transition-colors sm:bottom-5 sm:right-5"
          style={{
            borderColor: B,
            color: "var(--foreground)",
            background: "rgba(10,10,10,0.92)",
          }}
        >
          Test This Trade
        </button>
      ) : null}

      {!proMode ? (
        <SimpleDecisionView data={decisionData} asset={activeAsset} />
      ) : activeView === "decision" ? (
        /* ════════════════ DECISION VIEW ════════════════ */
        <div>
          {/* Chart + Decision side-by-side */}
          <div
            className="grid grid-cols-1 border-b xl:grid-cols-[minmax(0,1fr)_500px]"
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

          {/* Signal Shape */}
          <div className="border-b" style={{ borderColor: B }}>
            {decisionData ? <DecisionRadar data={decisionData} /> : <div className="px-6 py-6"><Skeleton lines={5} /></div>}
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
      ) : activeView === "relationship" ? (
        /* ════════════════ RELATIONSHIP VIEW ════════════════ */
        <RelationshipModule asset={activeAsset} />
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
