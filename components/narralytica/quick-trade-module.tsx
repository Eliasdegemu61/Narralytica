"use client";

import { useMemo, useState } from "react";

import { formatPrice } from "@/lib/format";
import type { DecisionAsset, QuickTradeInputPayload } from "@/lib/supabase/data";

const B = "var(--border-subtle)";
const TRUST_WINDOW_MINUTES = 5;

type StrategyDirection = "long" | "short" | "wait";

type StrategyResult = {
  key: string;
  label: string;
  direction: StrategyDirection;
  score: number;
  summary: string;
  timeframe: string;
};

type TradePlan = {
  action: "LONG" | "SHORT" | "WAIT";
  color: string;
  track: string;
  title: string;
  reason: string;
  confidence: number;
  confidenceLabel: string;
  setupState: string;
  setupNote: string;
  lead: StrategyResult | null;
  bullishCount: number;
  bearishCount: number;
  stale: boolean;
  leverage: string;
  entryLabel: string;
  entryLow: number;
  entryHigh: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number | null;
};

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sma(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ageMinutes(timestamp: string | null | undefined) {
  if (!timestamp) return null;
  return Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
}

function waitWindow(minutes: number | null) {
  if (minutes == null) return "1-2";
  const min = Math.max(1, 6 - minutes);
  const max = min + 1;
  return `${min}-${max}`;
}

function buildBreakoutResult(data: QuickTradeInputPayload): StrategyResult {
  const rules = data.strategy_playbook.breakout_continuation?.client_rules ?? {};
  const rows = data.datasets.klines["5m"] ?? [];
  const lookback = Math.max(6, asNumber(rules.range_lookback_candles_5m) || 12);
  const buffer = asNumber(rules.close_buffer_pct) || 0.0004;
  const sample = rows.slice(-(lookback + 1));
  if (sample.length < lookback + 1) {
    return { key: "breakout_continuation", label: "Breakout", direction: "wait", score: 0, summary: "Not enough 5m candles yet.", timeframe: "5m" };
  }

  const latest = sample[sample.length - 1];
  const prior = sample.slice(0, -1);
  const priorHigh = Math.max(...prior.map((row) => asNumber(row.high)));
  const priorLow = Math.min(...prior.map((row) => asNumber(row.low)));
  const latestClose = asNumber(latest.close);

  if (latestClose > priorHigh * (1 + buffer)) {
    return {
      key: "breakout_continuation",
      label: "Breakout",
      direction: "long",
      score: 84,
      summary: "Price is pushing above the recent 5m range high.",
      timeframe: "5m",
    };
  }

  if (latestClose < priorLow * (1 - buffer)) {
    return {
      key: "breakout_continuation",
      label: "Breakout",
      direction: "short",
      score: 84,
      summary: "Price is slipping under the recent 5m range low.",
      timeframe: "5m",
    };
  }

  return {
    key: "breakout_continuation",
    label: "Breakout",
    direction: "wait",
    score: 28,
    summary: "Price is still trapped inside the short-term range.",
    timeframe: "5m",
  };
}

function buildTrendPullbackResult(data: QuickTradeInputPayload): StrategyResult {
  const rules = data.strategy_playbook.trend_pullback?.client_rules ?? {};
  const rows15 = data.datasets.klines["15m"] ?? [];
  const rows1h = data.datasets.klines["1h"] ?? [];
  const maxPullback = asNumber(rules.max_pullback_pct_from_fast_sma) || 0.006;
  if (rows15.length < 55 || rows1h.length < 25) {
    return { key: "trend_pullback", label: "Trend Pullback", direction: "wait", score: 0, summary: "Not enough trend data yet.", timeframe: "15m / 1h" };
  }

  const close15 = rows15.map((row) => asNumber(row.close));
  const close1h = rows1h.map((row) => asNumber(row.close));
  const latest15 = close15[close15.length - 1];
  const fast15 = sma(close15.slice(-20));
  const slow15 = sma(close15.slice(-50));
  const fast1h = sma(close1h.slice(-20));
  const latest1h = close1h[close1h.length - 1];
  const pullbackPct = fast15 ? Math.abs(latest15 - fast15) / fast15 : 1;

  const trendLong = latest15 > fast15 && fast15 > slow15 && latest1h > fast1h && pullbackPct <= maxPullback;
  const trendShort = latest15 < fast15 && fast15 < slow15 && latest1h < fast1h && pullbackPct <= maxPullback;

  if (trendLong) {
    return {
      key: "trend_pullback",
      label: "Trend Pullback",
      direction: "long",
      score: 78,
      summary: "The larger trend is still up and the pullback remains controlled.",
      timeframe: "15m / 1h",
    };
  }

  if (trendShort) {
    return {
      key: "trend_pullback",
      label: "Trend Pullback",
      direction: "short",
      score: 78,
      summary: "The larger trend is still down and the bounce remains weak.",
      timeframe: "15m / 1h",
    };
  }

  return {
    key: "trend_pullback",
    label: "Trend Pullback",
    direction: "wait",
    score: 32,
    summary: "Trend and pullback conditions are not lined up yet.",
    timeframe: "15m / 1h",
  };
}

function buildFailedBreakResult(data: QuickTradeInputPayload): StrategyResult {
  const rules = data.strategy_playbook.failed_break_reclaim?.client_rules ?? {};
  const rows = data.datasets.klines["5m"] ?? [];
  const lookback = Math.max(10, asNumber(rules.sweep_lookback_candles_5m) || 20);
  const buffer = asNumber(rules.reclaim_close_buffer_pct) || 0.0003;
  if (rows.length < lookback + 2) {
    return { key: "failed_break_reclaim", label: "Reclaim", direction: "wait", score: 0, summary: "Not enough reclaim candles yet.", timeframe: "5m" };
  }

  const previousWindow = rows.slice(-(lookback + 2), -2);
  const sweepCandle = rows[rows.length - 2];
  const latest = rows[rows.length - 1];
  const windowLow = Math.min(...previousWindow.map((row) => asNumber(row.low)));
  const windowHigh = Math.max(...previousWindow.map((row) => asNumber(row.high)));
  const latestClose = asNumber(latest.close);

  const longReclaim = asNumber(sweepCandle.low) < windowLow && latestClose > windowLow * (1 + buffer);
  const shortReject = asNumber(sweepCandle.high) > windowHigh && latestClose < windowHigh * (1 - buffer);

  if (longReclaim) {
    return {
      key: "failed_break_reclaim",
      label: "Reclaim",
      direction: "long",
      score: 74,
      summary: "A downside sweep was reclaimed by the next candle.",
      timeframe: "5m",
    };
  }

  if (shortReject) {
    return {
      key: "failed_break_reclaim",
      label: "Reclaim",
      direction: "short",
      score: 74,
      summary: "An upside sweep failed and price fell back below resistance.",
      timeframe: "5m",
    };
  }

  return {
    key: "failed_break_reclaim",
    label: "Reclaim",
    direction: "wait",
    score: 26,
    summary: "No clean reclaim setup is visible yet.",
    timeframe: "5m",
  };
}

function buildFundingOiResult(data: QuickTradeInputPayload): StrategyResult {
  const rules = data.strategy_playbook.funding_oi_confirmation?.client_rules ?? {};
  const oiRows = data.datasets.open_interest_5m ?? [];
  const fundingRows = data.datasets.funding_rates ?? [];
  const ratioRows = data.datasets.long_short_ratio_1h ?? [];
  const closes = (data.datasets.klines["5m"] ?? []).map((row) => asNumber(row.close));
  if (oiRows.length < 7 || fundingRows.length < 1 || ratioRows.length < 1 || closes.length < 7) {
    return { key: "funding_oi_confirmation", label: "Funding + OI", direction: "wait", score: 0, summary: "Derivatives context is still sparse.", timeframe: "5m / 1h" };
  }

  const oiWindow = Math.max(2, asNumber(rules.open_interest_change_window) || 6);
  const oiNow = asNumber(oiRows[oiRows.length - 1].sum_open_interest_value ?? oiRows[oiRows.length - 1].sum_open_interest);
  const oiThen = asNumber(oiRows[Math.max(0, oiRows.length - 1 - oiWindow)].sum_open_interest_value ?? oiRows[Math.max(0, oiRows.length - 1 - oiWindow)].sum_open_interest);
  const oiChangePct = oiThen ? ((oiNow / oiThen) - 1) * 100 : 0;
  const funding = asNumber(fundingRows[fundingRows.length - 1].funding_rate);
  const ratio = asNumber(ratioRows[ratioRows.length - 1].long_short_ratio);
  const closeNow = closes[closes.length - 1];
  const closeThen = closes[Math.max(0, closes.length - 1 - oiWindow)];
  const priceUp = closeNow >= closeThen;
  const expansionThreshold = asNumber(rules.open_interest_expansion_pct) || 0.8;
  const overheat = asNumber(rules.funding_overheat_threshold) || 0.0001;
  const ratioCeiling = asNumber(rules.long_short_ratio_ceiling) || 1.35;
  const ratioFloor = asNumber(rules.long_short_ratio_floor) || 0.75;

  const bullish = oiChangePct >= expansionThreshold && priceUp && funding < overheat && ratio < ratioCeiling;
  const bearish = oiChangePct >= expansionThreshold && !priceUp && funding > -overheat && ratio > ratioFloor;

  if (bullish) {
    return {
      key: "funding_oi_confirmation",
      label: "Funding + OI",
      direction: "long",
      score: 70,
      summary: "Open interest is expanding without longs getting too crowded.",
      timeframe: "5m / 1h",
    };
  }

  if (bearish) {
    return {
      key: "funding_oi_confirmation",
      label: "Funding + OI",
      direction: "short",
      score: 70,
      summary: "Open interest is expanding while downside pressure stays in control.",
      timeframe: "5m / 1h",
    };
  }

  return {
    key: "funding_oi_confirmation",
    label: "Funding + OI",
    direction: "wait",
    score: 30,
    summary: "Derivatives positioning is not confirming a fast trade yet.",
    timeframe: "5m / 1h",
  };
}

function buildStrategyResults(data: QuickTradeInputPayload) {
  return [
    buildBreakoutResult(data),
    buildTrendPullbackResult(data),
    buildFailedBreakResult(data),
    buildFundingOiResult(data),
  ];
}

function buildTradePlan(results: StrategyResult[], referencePrice: number, fetchedAt: string | null): TradePlan {
  const age = ageMinutes(fetchedAt);
  const stale = age == null || age > TRUST_WINDOW_MINUTES;
  const bullish = results.filter((result) => result.direction === "long");
  const bearish = results.filter((result) => result.direction === "short");
  const bullishScore = bullish.reduce((sum, result) => sum + result.score, 0);
  const bearishScore = bearish.reduce((sum, result) => sum + result.score, 0);

  let action: TradePlan["action"] = "WAIT";
  let lead: StrategyResult | null = null;
  let color = "var(--foreground)";
  let track = "var(--surface-2)";
  let title = "No clean quick trade yet";
  let reason = `Wait ${waitWindow(age)} minutes and reopen for a sharper entry read.`;
  let setupState = "Stand aside";
  let setupNote = "No side has enough alignment to justify a fast trade.";

  if (!stale && bullish.length >= 2 && bullishScore >= 140 && bullishScore > bearishScore + 25) {
    action = "LONG";
    lead = [...bullish].sort((a, b) => b.score - a.score)[0];
    color = "var(--bull)";
    track = "var(--bull-track)";
    title = `${lead?.label ?? "Momentum"} long setup`;
    reason = "Bias is long right now. The best entry zone is around the band below.";
    setupState = "Long bias active";
    setupNote = "Momentum and confirmation are aligned enough for a tactical long read.";
  } else if (!stale && bearish.length >= 2 && bearishScore >= 140 && bearishScore > bullishScore + 25) {
    action = "SHORT";
    lead = [...bearish].sort((a, b) => b.score - a.score)[0];
    color = "var(--bear)";
    track = "var(--bear-track)";
    title = `${lead?.label ?? "Momentum"} short setup`;
    reason = "Bias is short right now. The best entry zone is around the band below.";
    setupState = "Short bias active";
    setupNote = "Downside pressure is the cleaner tactical side right now.";
  } else if (!stale) {
    lead = [...results].sort((a, b) => b.score - a.score)[0] ?? null;
    title = "Setup is still mixed";
    reason = lead ? `${lead.label} is the closest match, but the overall setup is not clean enough yet.` : "No fast setup is ready yet.";
    setupState = "Mixed conditions";
    setupNote = "One setup is close, but the engine still sees crosscurrents.";
  }

  const leverage =
    action === "WAIT" ? "No leverage" :
    lead?.key === "breakout_continuation" ? "5x" :
    lead?.key === "funding_oi_confirmation" ? "4x" :
    "3x";

  const entryBuffer = action === "WAIT" ? 0.001 : lead?.key === "trend_pullback" ? 0.0012 : 0.0018;
  const tpPct = action === "WAIT" ? 0 : action === "LONG" ? 0.006 : -0.006;
  const slPct = action === "WAIT" ? 0 : action === "LONG" ? -0.0035 : 0.0035;
  const leadScore = lead?.score ?? 0;
  const confidence =
    action === "WAIT"
      ? Math.max(22, leadScore)
      : Math.min(95, leadScore + Math.abs(bullishScore - bearishScore) * 0.18 + 8);
  const confidenceLabel =
    confidence >= 80 ? "High conviction" :
    confidence >= 62 ? "Good alignment" :
    confidence >= 45 ? "Developing" :
    "Early read";
  const riskReward = slPct !== 0 ? Math.abs(tpPct / slPct) : null;
  const entryLow = referencePrice * (1 - entryBuffer);
  const entryHigh = referencePrice * (1 + entryBuffer);

  return {
    action,
    color,
    track,
    title,
    reason,
    confidence,
    confidenceLabel,
    setupState,
    setupNote,
    lead,
    bullishCount: bullish.length,
    bearishCount: bearish.length,
    stale,
    leverage,
    entryLabel: action === "WAIT" ? "Watch the next refresh" : `${formatPrice(entryLow)} - ${formatPrice(entryHigh)}`,
    entryLow,
    entryHigh,
    takeProfit: referencePrice * (1 + tpPct),
    stopLoss: referencePrice * (1 + slPct),
    riskReward,
  };
}

function PlanStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
      <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
        {label}
      </p>
      <p className="mt-2 text-[14px] font-mono font-bold leading-relaxed" style={{ color: accent ?? "var(--foreground)" }}>
        {value}
      </p>
    </div>
  );
}

function statusCopy(minutes: number | null, stale: boolean) {
  if (minutes == null) return "Snapshot time unavailable";
  if (stale) return `Snapshot is ${minutes}m old`;
  return `Snapshot refreshed ${minutes}m ago`;
}

function pctFromReference(value: number, reference: number) {
  if (!reference) return 0;
  return ((value - reference) / reference) * 100;
}

function signedPctLabel(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function QuickTradeModule({
  asset,
  data,
  decision,
  loading = false,
  fetchedAt = null,
}: {
  asset: string;
  data: QuickTradeInputPayload | null;
  decision?: DecisionAsset;
  loading?: boolean;
  fetchedAt?: string | null;
  drawer?: boolean;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const referencePrice = data?.latest_context.reference_price ?? decision?.reference_price ?? 0;
  const results = useMemo(() => (data ? buildStrategyResults(data) : []), [data]);
  const plan = useMemo(
    () => (data ? buildTradePlan(results, referencePrice, fetchedAt) : null),
    [data, results, referencePrice, fetchedAt],
  );
  const snapshotAge = ageMinutes(fetchedAt);
  const dominantScore = plan?.lead?.score ?? 0;
  const biasTotal = Math.max(1, (plan?.bullishCount ?? 0) + (plan?.bearishCount ?? 0));
  const longBiasPct = ((plan?.bullishCount ?? 0) / biasTotal) * 100;
  const shortBiasPct = ((plan?.bearishCount ?? 0) / biasTotal) * 100;
  const stopDistancePct = pctFromReference(plan?.stopLoss ?? 0, referencePrice);
  const targetDistancePct = pctFromReference(plan?.takeProfit ?? 0, referencePrice);

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-5 sm:py-7" style={{ background: "var(--background)" }}>
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
          Quick Trade
        </p>
        <p className="mt-2 text-[18px] font-sans font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Building tactical setup
        </p>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--bull)" }} />
          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--foreground-faint)", animationDelay: "120ms" }} />
          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "var(--foreground-faint)", animationDelay: "240ms" }} />
        </div>
        <p className="mt-5 text-[12px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
          Pulling the latest {asset} snapshot and scoring the fast setups.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6 sm:px-5 sm:py-7" style={{ background: "var(--background)" }}>
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
          Quick Trade
        </p>
        <p className="mt-2 text-[18px] font-sans font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          Waiting for a live snapshot
        </p>
        <p className="mt-3 text-[12px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
          Open this panel for the latest tactical read on {asset}, including entry region, stop, and setup alignment.
        </p>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="min-h-full border-b" style={{ borderColor: B, background: "var(--background)" }}>
      <div className="px-4 py-5 sm:px-5 sm:py-6">
        <div
          className="rounded-[28px] border p-4 sm:p-5"
          style={{
            borderColor: B,
            background: `linear-gradient(180deg, ${plan.track} 0%, rgba(255,255,255,0.02) 34%, rgba(255,255,255,0) 100%)`,
            boxShadow: "0 20px 70px rgba(0,0,0,0.24)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Quick Trade Engine
              </p>
              <p className="mt-2 text-[20px] font-sans font-semibold tracking-tight" style={{ color: plan.color }}>
                {plan.title}
              </p>
              <p className="mt-2 max-w-2xl text-[12px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
                {plan.setupNote}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
                style={{ color: plan.color, background: plan.track }}
              >
                {plan.action}
              </span>
              <span
                className="rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
                style={{ borderColor: B, color: plan.stale ? "var(--bear)" : "var(--foreground-faint)" }}
              >
                {statusCopy(snapshotAge, plan.stale)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "rgba(0,0,0,0.18)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                  Tactical Read
                </p>
                <p className="mt-2 text-[13px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
                  {plan.reason}
                </p>
              </div>
              <div className="min-w-[124px]">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                  <span>{plan.confidenceLabel}</span>
                  <span style={{ color: plan.color }}>{Math.round(plan.confidence)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full" style={{ width: `${plan.confidence}%`, background: plan.color }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--surface)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Setup State
              </p>
              <p className="mt-2 text-[15px] font-mono font-bold" style={{ color: plan.color }}>
                {plan.setupState}
              </p>
              <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                {plan.action === "WAIT" ? "Stay selective" : "Use only as a tactical read"}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--surface)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Lead Setup
              </p>
              <p className="mt-2 text-[15px] font-mono font-bold" style={{ color: plan.color }}>
                {plan.lead?.label ?? "No dominant setup"}
              </p>
              <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                {plan.lead?.timeframe ?? "Watching multiple frames"}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--surface)" }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Dominant Score
              </p>
              <p className="mt-2 text-[15px] font-mono font-bold" style={{ color: dominantScore >= 70 ? plan.color : "var(--foreground)" }}>
                {dominantScore}/100
              </p>
              <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                {plan.bullishCount} long vs {plan.bearishCount} short
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border p-4 sm:p-5" style={{ borderColor: B, background: "var(--surface)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Execution Map
              </p>
              <p className="mt-2 text-[16px] font-sans font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
                {plan.action === "WAIT" ? "No fast order yet" : `${asset} quick trade plan`}
              </p>
            </div>
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
              style={{ borderColor: B, color: plan.color }}
            >
              {plan.leverage}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plan.action === "WAIT" ? (
              <>
                <PlanStat label="Recheck Window" value={`${waitWindow(snapshotAge)} minutes`} />
                <PlanStat label="Current Read" value="No entry yet" accent="var(--foreground)" />
              </>
            ) : (
              <>
                <PlanStat label="Entry Region" value={plan.entryLabel} />
                <PlanStat
                  label="Risk / Reward"
                  value={`${plan.riskReward?.toFixed(2) ?? "0.00"}R`}
                  accent={plan.color}
                />
                <PlanStat
                  label="Take Profit"
                  value={`${formatPrice(plan.takeProfit)} · ${signedPctLabel(targetDistancePct)}`}
                  accent="var(--bull)"
                />
                <PlanStat
                  label="Stop Loss"
                  value={`${formatPrice(plan.stopLoss)} · ${signedPctLabel(stopDistancePct)}`}
                  accent="var(--bear)"
                />
              </>
            )}
          </div>

          <div className="mt-5 rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                Signal Balance
              </p>
              <p className="text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
                {plan.bullishCount} long vs {plan.bearishCount} short
              </p>
            </div>
            <div className="mt-3 flex overflow-hidden rounded-full" style={{ height: "8px", background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${longBiasPct}%`, background: "var(--bull)" }} />
              <div style={{ width: `${shortBiasPct}%`, background: "var(--bear)" }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
              <span>Long pressure {Math.round(longBiasPct)}%</span>
              <span>Short pressure {Math.round(shortBiasPct)}%</span>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border p-4 sm:p-5" style={{ borderColor: B, background: "var(--surface)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Breakdown
              </p>
              <p className="mt-2 text-[12px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
                {plan.action === "WAIT"
                  ? "This panel is best used as a watchlist-grade tactical read until one side takes over."
                  : `The engine sees a ${plan.action.toLowerCase()}-leaning setup. Use the band, stop, and balance below as a compact execution framework.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReasoning((value) => !value)}
              className="rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] font-bold"
              style={{ borderColor: B, color: "var(--foreground)" }}
            >
              {showReasoning ? "Hide Logic" : "Show Logic"}
            </button>
          </div>

          {showReasoning ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
                <p className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                  Engine Rule
                </p>
                <p className="mt-2 text-[12px] font-mono leading-[1.8]" style={{ color: "var(--foreground-muted)" }}>
                  The quick-trade read only upgrades to LONG or SHORT when multiple fast setups point the same way and that side clearly outweighs the other.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {results.map((result) => {
                  const accent = result.direction === "long" ? "var(--bull)" : result.direction === "short" ? "var(--bear)" : "var(--foreground-faint)";
                  const track = result.direction === "long" ? "var(--bull-track)" : result.direction === "short" ? "var(--bear-track)" : "var(--surface-2)";
                  return (
                    <div key={result.key} className="rounded-2xl border px-4 py-4" style={{ borderColor: B, background: "var(--background)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                          {result.label}
                        </p>
                        <span className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--foreground-faint)" }}>
                          {result.timeframe}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] font-bold" style={{ color: accent, background: track }}>
                          {result.direction === "wait" ? "watch" : result.direction}
                        </span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: accent }}>
                          {result.score}
                        </span>
                      </div>
                      <p className="mt-3 text-[12px] font-mono leading-[1.7]" style={{ color: "var(--foreground-muted)" }}>
                        {result.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
