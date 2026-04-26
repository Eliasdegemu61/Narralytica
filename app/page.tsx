"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLatestAssetState, fetchMarketOverview, fetchQuickTradeInputs, type MarketOverview, type DecisionAsset, type QuickTradeInputPayload } from "@/lib/supabase/data";
import { HeaderBar, type ActiveView } from "@/components/narralytica/header-bar";
import { FearGreedModule } from "@/components/narralytica/fear-greed-module";
import { EtfFlowModule } from "@/components/narralytica/etf-flow-module";
import { OpenInterestModule } from "@/components/narralytica/open-interest-module";
import { DecisionHeader } from "@/components/narralytica/decision-header";
import { ComponentScoreCard } from "@/components/narralytica/component-score-card";
import { PriceChart } from "@/components/narralytica/price-chart";
import { RelationshipModule } from "@/components/narralytica/relationship-module";
import { QuickTradeModule } from "@/components/narralytica/quick-trade-module";
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

function tradeDirection(action: string) {
  if (action === "perps_short") return -1;
  if (action === "perps_long" || action === "spot_long") return 1;
  return 0;
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
  const [entryMode, setEntryMode] = useState<"market" | "limit">("market");
  const [planStyle, setPlanStyle] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [customTargetPct, setCustomTargetPct] = useState(0.8);

  const direction = tradeDirection(decision.action);
  const isPerps = decision.action === "perps_long" || decision.action === "perps_short";
  const isSpot = decision.action === "spot_long";
  const isWait = decision.action === "wait";
  const liveEntry = livePrice > 0 ? livePrice : data.reference_price ?? 0;
  const baseTargetPct = Math.abs(tradeTargetPercent(decision.action));
  const baseStopPct =
    decision.conviction === "high" ? 0.0025 :
    decision.conviction === "medium" ? 0.0035 :
    0.0045;
  const scenario =
    planStyle === "conservative"
      ? { label: "Conservative", targetMult: 0.8, stopMult: 0.85, entryOffset: 0.0008, sizeMult: 0.8 }
      : planStyle === "aggressive"
        ? { label: "Aggressive", targetMult: 1.75, stopMult: 1.15, entryOffset: 0.0014, sizeMult: 1.2 }
        : { label: "Balanced", targetMult: 1, stopMult: 1, entryOffset: 0.0011, sizeMult: 1 };
  const entry =
    liveEntry > 0 && entryMode === "limit" && direction !== 0
      ? liveEntry * (1 + (direction === 1 ? -scenario.entryOffset : scenario.entryOffset))
      : liveEntry;
  const targetPct = Math.max(0, customTargetPct / 100);
  const stopPct = baseStopPct * scenario.stopMult;
  const targetPrice = entry > 0 && direction !== 0 ? entry * (1 + direction * targetPct) : 0;
  const stopPrice = entry > 0 && direction !== 0 ? entry * (1 - direction * stopPct) : 0;
  const leverage = tradeLeverage(decision.action);
  const notional = amountUsd * leverage;
  const quantity = entry > 0 ? notional / entry : 0;
  const grossTargetPnl = direction === 0 ? 0 : Math.abs(targetPrice - entry) * quantity;
  const grossStopLoss = direction === 0 ? 0 : Math.abs(stopPrice - entry) * quantity;
  const targetPnl = grossTargetPnl;
  const stopLoss = -grossStopLoss;
  const riskReward = grossStopLoss > 0 ? grossTargetPnl / grossStopLoss : null;
  const supportCount = data.signal_story.evidence.supporting_components.length;
  const totalSignals = Math.max(
    supportCount + data.signal_story.evidence.opposing_components.length,
    data.signal_story.component_cards.length,
    1,
  );
  const downside = -stopPct;
  const setupAccent =
    decision.action === "perps_short" ? "var(--bear)" :
    decision.action === "wait" ? "var(--foreground-faint)" :
    "var(--bull)";
  const setupTrack =
    decision.action === "perps_short" ? "var(--bear-track)" :
    decision.action === "wait" ? "var(--surface-2)" :
    "var(--bull-track)";
  const invalidationLead = data.signal_story.invalidations[0] ?? "Wait for a cleaner setup before risking capital.";
  const rationale = data.signal_story.why.slice(0, 3);
  const recommendedSizeText =
    decision.position_size_bucket === "large" ? "Full risk unit" :
    decision.position_size_bucket === "medium" ? "Half risk unit" :
    "Starter size only";
  const liquidationPct = isPerps ? Math.max(0.03, (1 / leverage) * 0.8) : null;
  const liquidationPrice =
    liquidationPct && direction !== 0 && entry > 0
      ? entry * (1 - direction * liquidationPct)
      : null;
  const riskPercentOfCapital = amountUsd > 0 ? Math.abs(stopLoss) / amountUsd : 0;

  return (
    <>
      <button
        type="button"
        aria-label="Close trade plan"
        className="fixed inset-0 z-30 bg-black/50"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-40 h-screen w-[min(460px,100vw)] border-l shadow-2xl"
        style={{
          borderColor: B,
          background: "rgba(8,8,8,0.97)",
          backdropFilter: "blur(18px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5" style={{ borderColor: B }}>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Trade Plan
              </p>
              <p className="mt-1 text-[13px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                {isWait
                  ? "No clean trade is active right now. Review risk first and avoid forcing an entry."
                  : "A live execution plan built from the current signal, with risk shown before reward."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
              style={{ borderColor: B, color: "var(--foreground-faint)" }}
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
                style={{ color: setupAccent, background: setupTrack }}
              >
                {actionLabel(decision.action)}
              </span>
              <span className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold" style={{ borderColor: B, color: "var(--foreground-faint)" }}>
                {actionMarket(decision.action)}
              </span>
              <span className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold" style={{ borderColor: B, color: "var(--foreground-faint)" }}>
                {decision.conviction} conviction
              </span>
              <span className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold" style={{ borderColor: B, color: "var(--foreground-faint)" }}>
                {decision.position_size_bucket} size
              </span>
            </div>

            <div className="mb-4 rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Risk First
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Max Loss</p>
                  <p className="mt-2 text-[24px] font-mono font-bold" style={{ color: "var(--bear)" }}>
                    {isWait ? "Stand Aside" : formatUsdCompact(Math.abs(stopLoss))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Risk / Reward</p>
                  <p className="mt-2 text-[24px] font-mono font-bold" style={{ color: riskReward && riskReward >= 1.5 ? "var(--bull)" : "var(--foreground)" }}>
                    {isWait || riskReward == null ? "No Trade" : `1 : ${riskReward.toFixed(2)}`}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Stop</p>
                  <p className="mt-2 text-[14px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
                    {isWait ? "Wait" : formatPrice(stopPrice)}
                  </p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--bear)" }}>
                    {formatPct(downside)}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Invalidation</p>
                  <p className="mt-2 text-[11px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                    {invalidationLead}
                  </p>
                </div>
              </div>
              {!isWait ? (
                <p className="mt-3 text-[11px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                  This plan risks about {formatPct(riskPercentOfCapital)} of deployed capital. Respect the stop first, then think about reward.
                </p>
              ) : null}
            </div>

            <div className="mb-4 rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Setup Controls
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["market", "limit"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEntryMode(mode)}
                    className="rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                    style={{
                      borderColor: B,
                      color: entryMode === mode ? "var(--foreground)" : "var(--foreground-faint)",
                      background: entryMode === mode ? "var(--surface-2)" : "transparent",
                    }}
                  >
                    {mode === "market" ? "Enter Now" : "Prefer Limit"}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["conservative", "balanced", "aggressive"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPlanStyle(mode)}
                    className="rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                    style={{
                      borderColor: B,
                      color: planStyle === mode ? "var(--foreground)" : "var(--foreground-faint)",
                      background: planStyle === mode ? "var(--surface-2)" : "transparent",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Capital</p>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amountUsd}
                    onChange={(event) => onAmountChange(Math.max(1, Number(event.target.value) || 1))}
                    className="mt-2 w-full bg-transparent text-[16px] font-mono font-bold outline-none"
                    style={{ color: "var(--foreground)" }}
                  />
                </label>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Suggested Size</p>
                  <p className="mt-2 text-[16px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
                    {recommendedSizeText}
                  </p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                    {scenario.label} profile
                  </p>
                </div>
              </div>
              <label className="mt-3 block rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Custom Target %</p>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={customTargetPct}
                  onChange={(event) => setCustomTargetPct(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full bg-transparent text-[16px] font-mono font-bold outline-none"
                  style={{ color: "var(--foreground)" }}
                />
              </label>
            </div>

            <div className="mb-4 rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Trade Ticket
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Entry</p>
                  <p className="mt-2 text-[16px] font-mono font-bold" style={{ color: "var(--foreground)" }}>{formatPrice(entry)}</p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                    {entryMode === "market" ? "Live market entry" : "Slightly better entry band"}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Target</p>
                  <p className="mt-2 text-[16px] font-mono font-bold" style={{ color: "var(--bull)" }}>
                    {isWait ? "Wait" : formatPrice(targetPrice)}
                  </p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                    {isWait ? "No follow-through target" : formatPct(direction * targetPct)}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Reward Move</p>
                  <p className="mt-2 text-[16px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
                    {isWait ? "Wait" : formatPct(direction * targetPct)}
                  </p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                    Target from entry
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Target P&L</p>
                  <p className="mt-2 text-[16px] font-mono font-bold" style={{ color: targetPnl >= 0 ? "var(--bull)" : "var(--foreground)" }}>
                    {isWait ? "No Trade" : `${targetPnl >= 0 ? "+" : ""}${formatUsdCompact(targetPnl)}`}
                  </p>
                  <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                    On target hit
                  </p>
                </div>
              </div>
              {isPerps && liquidationPrice ? (
                <div className="mt-3 rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Perps Warning</p>
                  <p className="mt-2 text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                    Approximate liquidation pressure would begin near <span style={{ color: "var(--bear)" }}>{formatPrice(liquidationPrice)}</span>. This is a rough estimate, not an exchange quote.
                  </p>
                </div>
              ) : null}
              {isSpot ? (
                <div className="mt-3 rounded-xl border px-3 py-3" style={{ borderColor: B, background: "var(--surface)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>Spot Note</p>
                  <p className="mt-2 text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                    Spot execution avoids liquidation mechanics, so the edge comes from discipline around invalidation, not extra leverage.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Reasoning
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.signal_story.evidence.supporting_components.slice(0, 4).map((item) => (
                  <span
                    key={`support-${item}`}
                    className="rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                    style={{ color: "var(--bull)", background: "var(--bull-track)" }}
                  >
                    {item}
                  </span>
                ))}
                {data.signal_story.evidence.opposing_components.slice(0, 2).map((item) => (
                  <span
                    key={`oppose-${item}`}
                    className="rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                    style={{ color: "var(--bear)", background: "var(--bear-track)" }}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {rationale.map((line, index) => (
                  <div key={`${line}-${index}`} className="flex gap-3">
                    <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: "var(--foreground-faint)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                      {line}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                Supported by {supportCount}/{totalSignals} visible signal components. The plan only stays valid while that balance remains intact.
              </p>
            </div>
          </div>
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
  const [heroChartHovered, setHeroChartHovered] = useState(false);
  const [tradeAmountUsd, setTradeAmountUsd] = useState(20);
  const [liveTradePrice, setLiveTradePrice] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<DecisionAsset[] | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [quickTradeInputs, setQuickTradeInputs] = useState<QuickTradeInputPayload | null>(null);
  const [quickTradeOpen, setQuickTradeOpen] = useState(false);
  const [quickTradeLoading, setQuickTradeLoading] = useState(false);
  const [quickTradeFetchedAt, setQuickTradeFetchedAt] = useState<string | null>(null);
  const quickTradeRequestId = useRef(0);

  // Get list of available assets from decisions
  const availableAssets = decisions?.map((d) => d.asset) ?? [];

  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      const [rows, overview] = await Promise.all([
        fetchLatestAssetState(),
        fetchMarketOverview(),
      ]);

      if (ignore) return;

      if (rows.length > 0) {
        setDecisions(rows);
        if (!rows.find((r) => r.asset === activeAsset)) {
          setActiveAsset(rows[0].asset);
        }
      }

      if (overview) {
        setMarketOverview(overview);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [activeAsset]);

  useEffect(() => {
    if (activeAsset !== "BTC" && activeAsset !== "ETH") {
      setQuickTradeOpen(false);
      setQuickTradeInputs(null);
      setQuickTradeFetchedAt(null);
      setQuickTradeLoading(false);
    }
  }, [activeAsset]);

  async function loadQuickTradeSnapshot() {
    if (activeAsset !== "BTC" && activeAsset !== "ETH") return;

    const requestId = ++quickTradeRequestId.current;
    setQuickTradeLoading(true);
    const startedAt = Date.now();
    const payload = await fetchQuickTradeInputs(activeAsset);
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 900 - elapsed);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    if (quickTradeRequestId.current !== requestId) return;

    setQuickTradeInputs(payload);
    setQuickTradeFetchedAt(new Date().toISOString());
    setQuickTradeLoading(false);
  }

  useEffect(() => {
    if (!quickTradeOpen) return;

    loadQuickTradeSnapshot();
    const interval = setInterval(loadQuickTradeSnapshot, 300000);
    return () => clearInterval(interval);
  }, [quickTradeOpen, activeAsset]);

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
          Review Trade Plan
        </button>
      ) : null}

      {(activeAsset === "BTC" || activeAsset === "ETH") && !quickTradeOpen ? (
        <button
          type="button"
          onClick={() => {
            setQuickTradeOpen(true);
            setQuickTradeInputs(null);
            setQuickTradeFetchedAt(null);
          }}
          className="fixed bottom-4 left-4 z-30 rounded-full border px-4 py-3 text-[11px] font-mono uppercase tracking-[0.16em] font-bold shadow-2xl transition-colors sm:bottom-5 sm:left-5"
          style={{
            borderColor: B,
            color: "var(--foreground)",
            background: "rgba(10,10,10,0.92)",
          }}
        >
          Quick Trade
        </button>
      ) : null}

      {quickTradeOpen ? (
        <>
          <button
            type="button"
            aria-label="Close quick trade drawer"
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setQuickTradeOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-40 h-screen w-[min(440px,100vw)] border-r shadow-2xl"
            style={{
              borderColor: B,
              background: "rgba(8,8,8,0.96)",
              backdropFilter: "blur(18px)",
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5" style={{ borderColor: B }}>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                  Quick Trade
                </p>
                <p className="mt-1 text-[12px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                  {activeAsset} tactical engine · on-demand
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickTradeOpen(false)}
                className="rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
                style={{ borderColor: B, color: "var(--foreground-faint)" }}
              >
                Close
              </button>
            </div>
            <div className="h-[calc(100vh-73px)] overflow-y-auto">
              <QuickTradeModule
                asset={activeAsset}
                data={quickTradeInputs}
                decision={decisionData}
                loading={quickTradeLoading}
                fetchedAt={quickTradeFetchedAt}
                drawer
              />
            </div>
          </aside>
        </>
      ) : null}

      {!proMode ? (
        <SimpleDecisionView data={decisionData} asset={activeAsset} />
      ) : activeView === "decision" ? (
        /* ════════════════ DECISION VIEW ════════════════ */
        <div>
          {/* Chart + Decision side-by-side */}
          <div
            className="relative border-b overflow-hidden"
            style={{ borderColor: B }}
            onMouseEnter={() => {
              if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                setHeroChartHovered(true);
              }
            }}
            onMouseLeave={() => setHeroChartHovered(false)}
          >
            <div className="absolute inset-0" style={{ background: "var(--background)" }}>
              <div
                className="absolute inset-0 scale-[1.01] opacity-50"
                style={{
                  filter: heroChartHovered ? "blur(2px)" : "blur(7px)",
                  opacity: heroChartHovered ? 0.66 : 0.5,
                  transformOrigin: "center",
                  transition: "filter 180ms ease, opacity 180ms ease",
                }}
              >
                <PriceChart asset={activeAsset} />
              </div>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(8,8,8,0.72) 0%, rgba(8,8,8,0.48) 32%, rgba(8,8,8,0.82) 100%)",
                }}
              />
            </div>

            <div className="relative z-10">
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

          {/* Market overlays moved from the removed Context view */}
          <div className="border-b" style={{ borderColor: B }}>
            <SectionLabel eyebrow="Market Overlays" title="Context" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="px-6 py-6 border-b sm:border-b-0 sm:border-r" style={{ borderColor: B }}>
                {marketOverview?.fear_greed ? <FearGreedModule data={marketOverview.fear_greed} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6 border-b lg:border-b-0 sm:border-r" style={{ borderColor: B }}>
                {marketOverview?.etf_metrics?.btc ? <EtfFlowModule asset="BTC" data={marketOverview.etf_metrics.btc} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6 border-b lg:border-b-0 sm:border-r" style={{ borderColor: B }}>
                {marketOverview?.etf_metrics?.eth ? <EtfFlowModule asset="ETH" data={marketOverview.etf_metrics.eth} /> : <Skeleton lines={4} />}
              </div>
              <div className="px-6 py-6">
                {marketOverview?.futures_open_interest ? <OpenInterestModule data={marketOverview.futures_open_interest} /> : <Skeleton lines={4} />}
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
      ) : null}
    </div>
  );
}



