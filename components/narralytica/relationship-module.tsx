"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import relationshipData from "@/market_relationship.json";
import type { NewsItem } from "@/lib/supabase/data";

interface SeriesPoint {
  time: number;
  value: number;
}

interface SeriesData {
  asset: string;
  candles: SeriesPoint[];
  color: string;
}

const B = "var(--border-subtle)";
const GRID = "#161616";
const LABEL = "#444444";
const PAD_TOP = 12;
const PAD_BOT = 30;
const PAD_LEFT = 0;
const PAD_RIGHT = 84;
const CHART_H = 320;
const NEWS_CHART_H = 340;
const TOP_FIVE = ["BTC", "ETH", "SOL", "XRP", "BNB"] as const;
const LOOKBACK_OPTIONS = ["6H", "12H", "24H", "3D", "7D"] as const;
const INTERVAL_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "4h"] as const;
const NEWS_WINDOW_OPTIONS = ["24H", "3D", "7D"] as const;
const WAVE_CATEGORIES = ["crypto", "stocks", "commodities", "indexes"] as const;
const WAVE_CATEGORY_LABELS: Record<(typeof WAVE_CATEGORIES)[number], string> = {
  crypto: "Crypto",
  stocks: "Stocks",
  commodities: "Commodities",
  indexes: "Indexes",
};
const WAVE_MARKETS: Record<(typeof WAVE_CATEGORIES)[number], string[]> = {
  crypto: ["BTC", "ETH", "SOL", "XRP", "BNB"],
  stocks: ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN"],
  commodities: ["XAUT", "CL", "SILVER", "COPPER", "GOLD"],
  indexes: ["USTECH100", "US500", "MAG7SSI", "DEFISSI", "MEMESSI"],
};
const COLORS: Record<string, string> = {
  BTC: "#f59e0b",
  ETH: "#3b82f6",
  SOL: "#8b5cf6",
  XRP: "#22c55e",
  BNB: "#eab308",
  ADA: "#2563eb",
  DOGE: "#f97316",
  AVAX: "#ef4444",
  LINK: "#06b6d4",
  HBAR: "#94a3b8",
  SUI: "#ec4899",
  AAPL: "#60a5fa",
  TSLA: "#ef4444",
  NVDA: "#22c55e",
  MSFT: "#38bdf8",
  AMZN: "#f59e0b",
  XAUT: "#fbbf24",
  CL: "#fb7185",
  SILVER: "#cbd5e1",
  COPPER: "#f97316",
  GOLD: "#fde047",
  USTECH100: "#22c55e",
  US500: "#60a5fa",
  MAG7SSI: "#f97316",
  DEFISSI: "#8b5cf6",
  MEMESSI: "#ec4899",
};
const LOOKBACK_MS: Record<(typeof LOOKBACK_OPTIONS)[number], number> = {
  "6H": 6 * 60 * 60 * 1000,
  "12H": 12 * 60 * 60 * 1000,
  "24H": 24 * 60 * 60 * 1000,
  "3D": 3 * 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
};
const NEWS_WINDOW_MS: Record<(typeof NEWS_WINDOW_OPTIONS)[number], number> = {
  "24H": 24 * 60 * 60 * 1000,
  "3D": 3 * 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
};
const INTERVAL_MS: Record<(typeof INTERVAL_OPTIONS)[number], number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
};
const NEWS_WINDOW_INTERVAL: Record<(typeof NEWS_WINDOW_OPTIONS)[number], (typeof INTERVAL_OPTIONS)[number]> = {
  "24H": "5m",
  "3D": "15m",
  "7D": "1h",
};
const KLINE_CONFIG: Partial<Record<string, { base: string; hasStartTime: boolean }>> = {
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
  AAPL: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=AAPL-USD", hasStartTime: true },
  TSLA: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=TSLA-USD", hasStartTime: true },
  NVDA: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=NVDA-USD", hasStartTime: true },
  MSFT: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=MSFT-USD", hasStartTime: true },
  AMZN: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=AMZN-USD", hasStartTime: true },
  XAUT: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=XAUT-USD", hasStartTime: true },
  CL: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=CL-USD", hasStartTime: true },
  SILVER: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=SILVER-USD", hasStartTime: true },
  COPPER: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=COPPER-USD", hasStartTime: true },
  GOLD: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=GOLD-USD", hasStartTime: true },
  USTECH100: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=USTECH100-USD", hasStartTime: true },
  US500: { base: "https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/q/kline?symbol=US500-USD", hasStartTime: true },
  MAG7SSI: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=MAG7ssi%2FUSDC", hasStartTime: true },
  DEFISSI: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=DEFIssi%2FUSDC", hasStartTime: true },
  MEMESSI: { base: "https://mainnet-gw.sodex.dev/pro/p/quotation/kline?symbol=MEMEssi%2FUSDC", hasStartTime: true },
};

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
        <span className="ml-auto text-[11px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground-faint)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded"
          style={{ background: "var(--surface-2)", width: `${55 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}

function fmtPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtAxisTime(ts: number, window: (typeof NEWS_WINDOW_OPTIONS)[number]) {
  return new Date(ts).toLocaleString("en-US", {
    month: window === "24H" ? undefined : "short",
    day: window === "24H" ? undefined : "numeric",
    hour: "2-digit",
    minute: window === "24H" ? "2-digit" : undefined,
    hour12: false,
  });
}

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function displayNewsTitle(item: NewsItem) {
  if (item.title?.trim()) return item.title.trim();
  const excerpt = item.content_excerpt?.trim() ?? "";
  return excerpt.length > 90 ? `${excerpt.slice(0, 90)}...` : excerpt || "Market update";
}

function normalizeHotNewsItem(raw: Record<string, unknown>): NewsItem | null {
  const releaseTime = Number(raw.release_time ?? 0);
  if (!releaseTime) return null;

  const title = typeof raw.title === "string" ? raw.title : "";
  const content = typeof raw.content === "string" ? raw.content : "";
  const sourceLink = typeof raw.source_link === "string" ? raw.source_link : null;
  const originalLink = typeof raw.original_link === "string" ? raw.original_link : sourceLink;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const matchedCurrencies = Array.isArray(raw.matched_currencies)
    ? raw.matched_currencies.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];

  return {
    id: String(raw.id ?? `${releaseTime}-${title || "hot-news"}`),
    asset: "CRYPTO_MARKET",
    title,
    original_title: title,
    timestamp_ms: releaseTime,
    timestamp_iso: new Date(releaseTime).toISOString(),
    bucket_open_ms_4h: Math.floor(releaseTime / (4 * 60 * 60 * 1000)) * (4 * 60 * 60 * 1000),
    bucket_open_iso_4h: new Date(Math.floor(releaseTime / (4 * 60 * 60 * 1000)) * (4 * 60 * 60 * 1000)).toISOString(),
    source_link: sourceLink,
    original_link: originalLink,
    category: typeof raw.category === "number" ? raw.category : Number(raw.category ?? 0),
    category_label: "hot_news",
    author: typeof raw.author === "string" ? raw.author : null,
    nick_name: typeof raw.nick_name === "string" ? raw.nick_name : null,
    tags,
    matched_currencies: matchedCurrencies,
    feature_image: typeof raw.feature_image === "string" ? raw.feature_image : null,
    content_excerpt: content,
    impression_count: Number(raw.impression_count ?? 0),
    like_count: Number(raw.like_count ?? 0),
    reply_count: Number(raw.reply_count ?? 0),
    retweet_count: Number(raw.retweet_count ?? 0),
    importance_score:
      Number(raw.impression_count ?? 0) / 1000 +
      Number(raw.like_count ?? 0) +
      Number(raw.reply_count ?? 0) +
      Number(raw.retweet_count ?? 0) +
      (typeof raw.category === "number" ? raw.category : Number(raw.category ?? 0)),
    is_major: true,
  };
}

function getRelationshipKlineUrl(asset: string, interval: (typeof INTERVAL_OPTIONS)[number], limit: number) {
  const config = KLINE_CONFIG[asset];
  if (!config) return null;

  const now = Date.now();
  let url = `${config.base}&interval=${interval}&limit=${limit}&endTime=${now}`;
  if (config.hasStartTime) {
    const startTime = now - limit * INTERVAL_MS[interval];
    url += `&startTime=${startTime}`;
  }
  return url;
}

export function RelationshipModule({ asset: activeAsset }: { asset: string }) {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([...TOP_FIVE]);
  const [lookback, setLookback] = useState<(typeof LOOKBACK_OPTIONS)[number]>("24H");
  const [klineInterval, setKlineInterval] = useState<(typeof INTERVAL_OPTIONS)[number]>("5m");
  const [waveCategory, setWaveCategory] = useState<(typeof WAVE_CATEGORIES)[number]>("crypto");
  const [newsWindow, setNewsWindow] = useState<(typeof NEWS_WINDOW_OPTIONS)[number]>("24H");
  const [series, setSeries] = useState<SeriesData[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [hotNews, setHotNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredNewsId, setHoveredNewsId] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [newsSeries, setNewsSeries] = useState<SeriesData[]>([]);
  const [loadingNewsSeries, setLoadingNewsSeries] = useState(true);
  const [newsChartWidth, setNewsChartWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const newsChartRef = useRef<HTMLDivElement>(null);
  const selectedAssetsKey = useMemo(() => selectedAssets.join(","), [selectedAssets]);
  const waveAssets = useMemo(() => WAVE_MARKETS[waveCategory], [waveCategory]);
  const waveAssetsKey = useMemo(() => waveAssets.join(","), [waveAssets]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartWidth(el.clientWidth));
    ro.observe(el);
    setChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = newsChartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNewsChartWidth(el.clientWidth));
    ro.observe(el);
    setNewsChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoadingSeries(true);

    const fetchSeries = async () => {
      const limit = Math.max(24, Math.min(1500, Math.ceil(LOOKBACK_MS[lookback] / INTERVAL_MS[klineInterval])));
      const assetsToFetch = selectedAssetsKey.split(",").filter(Boolean);
      const requests = assetsToFetch.map(async (asset) => {
        const url = getRelationshipKlineUrl(asset, klineInterval, limit);
        if (!url) return null;

        try {
          const res = await fetch(url, { cache: "no-store" });
          const json = await res.json();
          if (json.code !== 0 || !Array.isArray(json.data) || json.data.length === 0) {
            return null;
          }

          const sorted = [...json.data].sort((a: any, b: any) => a.t - b.t);
          const firstClose = parseFloat(sorted[0].c);
          const candles = sorted.map((k: any) => ({
            time: Number(k.t),
            value: ((parseFloat(k.c) - firstClose) / firstClose) * 100,
          }));

          return {
            asset,
            candles,
            color: COLORS[asset] ?? "var(--accent)",
          } satisfies SeriesData;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(requests);
      if (ignore) return;
      setSeries(results.filter((item): item is SeriesData => item !== null));
      setLoadingSeries(false);
    };

    fetchSeries();
    const intervalId = window.setInterval(fetchSeries, 60_000);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [selectedAssetsKey, lookback, klineInterval]);

  useEffect(() => {
    let ignore = false;
    setLoadingNews(true);

    const fetchNews = async () => {
      try {
        const endTime = Date.now();
        const startTime = endTime - 7 * 24 * 60 * 60 * 1000 + 60_000;
        const res = await fetch(
          `https://api.sosovalue.xyz/openapi/v1/news/hot?start_time=${startTime}&end_time=${endTime}&pageNum=1&pageSize=100`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to fetch hot news");
        }
        if (json?.code !== 0) {
          throw new Error(json?.message || "Hot news request was rejected");
        }
        if (ignore) return;
        const list = Array.isArray(json?.data?.list) ? json.data.list : [];
        const normalized = list
          .map((item: Record<string, unknown>) => normalizeHotNewsItem(item))
          .filter((item: NewsItem | null): item is NewsItem => item !== null)
          .sort((a, b) => b.timestamp_ms - a.timestamp_ms);
        setHotNews(normalized);
      } catch (error) {
        if (!ignore) {
          console.error("[relationship] hot news fetch error:", error);
          setHotNews([]);
        }
      } finally {
        if (!ignore) {
          setLoadingNews(false);
        }
      }
    };

    fetchNews();
    const intervalId = setInterval(fetchNews, 60_000);
    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoadingNewsSeries(true);

    const fetchNewsSeries = async () => {
      const interval = NEWS_WINDOW_INTERVAL[newsWindow];
      const limit = Math.max(24, Math.min(500, Math.ceil(NEWS_WINDOW_MS[newsWindow] / INTERVAL_MS[interval])));
      const requests = waveAssets.map(async (asset) => {
        const url = getRelationshipKlineUrl(asset, interval, limit);
        if (!url) return null;
        try {
          const res = await fetch(url, { cache: "no-store" });
          const json = await res.json();
          if (json.code !== 0 || !Array.isArray(json.data) || json.data.length === 0) {
            return null;
          }
          const sorted = [...json.data].sort((a: any, b: any) => a.t - b.t);
          const firstClose = parseFloat(sorted[0].c);
          const candles = sorted.map((k: any) => ({
            time: Number(k.t),
            value: ((parseFloat(k.c) - firstClose) / firstClose) * 100,
          }));

          return {
            asset,
            candles,
            color: COLORS[asset] ?? "var(--accent)",
          } satisfies SeriesData;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(requests);
      if (ignore) return;
      setNewsSeries(results.filter((item): item is SeriesData => item !== null));
      setLoadingNewsSeries(false);
    };

    fetchNewsSeries();
    const intervalId = window.setInterval(fetchNewsSeries, 60_000);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [waveAssetsKey, newsWindow]);

  const metrics = useMemo(() => {
    if (!series.length) return null;

    const latest = series
      .map((item) => ({
        asset: item.asset,
        value: item.candles[item.candles.length - 1]?.value ?? 0,
        color: item.color,
      }))
      .sort((a, b) => b.value - a.value);

    const leader = latest[0];
    const laggard = latest[latest.length - 1];
    const anchor = latest.find((item) => item.asset === activeAsset) ?? leader;
    const alignedCount = latest.filter((item) => (anchor.value >= 0 ? item.value >= 0 : item.value < 0)).length;
    const majorityPositive = latest.filter((item) => item.value >= 0).length;
    const majorityDirection = majorityPositive >= Math.ceil(latest.length / 2) ? "bullish" : "bearish";
    const diverging =
      (anchor.value >= 0 && majorityDirection === "bearish") ||
      (anchor.value < 0 && majorityDirection === "bullish");

    let summary = `${leader.asset} is leading while ${laggard.asset} is trailing.`;
    if (diverging) {
      summary = `${activeAsset} is diverging from the broader basket.`;
    } else if (alignedCount >= 4) {
      summary = `${alignedCount} of ${latest.length} majors are aligned with ${activeAsset}.`;
    } else if (alignedCount <= 2) {
      summary = `${activeAsset} is seeing weak confirmation from the top-pair basket.`;
    }

    return {
      latest,
      leader,
      laggard,
      anchor,
      alignedCount,
      summary,
    };
  }, [series, activeAsset]);

  const chartMeta = useMemo(() => {
    const allValues = series.flatMap((item) => item.candles.map((candle) => candle.value));
    const minVal = allValues.length ? Math.min(...allValues) : -1;
    const maxVal = allValues.length ? Math.max(...allValues) : 1;
    const range = maxVal - minVal || 1;
    const pad = range * 0.08;
    const yMin = minVal - pad;
    const yMax = maxVal + pad;
    const maxLen = series.reduce((memo, item) => Math.max(memo, item.candles.length), 0);
    const drawW = Math.max(0, chartWidth - PAD_LEFT - PAD_RIGHT);
    const drawH = CHART_H - PAD_TOP - PAD_BOT;

    return {
      yMin,
      yMax,
      maxLen,
      drawW,
      drawH,
      toX: (idx: number, total: number) => PAD_LEFT + (idx / (total - 1 || 1)) * drawW,
      toY: (value: number) => PAD_TOP + drawH - ((value - yMin) / (yMax - yMin)) * drawH,
      yTicks: Array.from({ length: 4 }, (_, i) => yMin + (yMax - yMin) * (i / 3)),
    };
  }, [series, chartWidth]);

  const groupedNews = useMemo(() => {
    const items = hotNews;
    const grouped = new Map<number, NewsItem[]>();
    const bucketSize = INTERVAL_MS[NEWS_WINDOW_INTERVAL[newsWindow]];

    for (const item of items) {
      const bucket = Math.floor(item.timestamp_ms / bucketSize) * bucketSize;
      const existing = grouped.get(bucket) ?? [];
      existing.push(item);
      grouped.set(bucket, existing);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, items]) => ({
        bucket,
        itemCount: items.length,
        topTitle: displayNewsTitle(items[0]),
        items: [...items].sort((a, b) => b.importance_score - a.importance_score),
      }));
  }, [hotNews, newsWindow]);

  const majorHeadlines = useMemo(() => {
    if (!hotNews.length) return [];

    const byDay = new Map<string, NewsItem[]>();
    for (const item of hotNews) {
      const key = dayKey(item.timestamp_ms);
      const existing = byDay.get(key) ?? [];
      existing.push(item);
      byDay.set(key, existing);
    }

    const orderedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
    const diversified: NewsItem[] = [];
    const maxPerDay = 3;
    let round = 0;

    while (diversified.length < 10) {
      let addedInRound = false;
      for (const key of orderedDays) {
        const dayItems = byDay.get(key) ?? [];
        if (round < Math.min(maxPerDay, dayItems.length)) {
          diversified.push(dayItems[round]);
          addedInRound = true;
          if (diversified.length >= 10) break;
        }
      }
      if (!addedInRound) break;
      round += 1;
    }

    return diversified;
  }, [hotNews]);

  const newsChartMeta = useMemo(() => {
    const allValues = newsSeries.flatMap((item) => item.candles.map((candle) => candle.value));
    const minVal = allValues.length ? Math.min(...allValues) : -1;
    const maxVal = allValues.length ? Math.max(...allValues) : 1;
    const range = maxVal - minVal || 1;
    const pad = range * 0.12;
    const yMin = minVal - pad;
    const yMax = maxVal + pad;
    const maxLen = newsSeries.reduce((memo, item) => Math.max(memo, item.candles.length), 0);
    const drawW = Math.max(0, newsChartWidth - PAD_LEFT - PAD_RIGHT);
    const drawH = NEWS_CHART_H - PAD_TOP - PAD_BOT;

    return {
      yMin,
      yMax,
      maxLen,
      drawW,
      drawH,
      toX: (idx: number, total: number) => PAD_LEFT + (idx / (total - 1 || 1)) * drawW,
      toY: (value: number) => PAD_TOP + drawH - ((value - yMin) / (yMax - yMin)) * drawH,
      yTicks: Array.from({ length: 4 }, (_, i) => yMin + (yMax - yMin) * (i / 3)),
    };
  }, [newsSeries, newsChartWidth]);

  const visibleNewsMarkers = useMemo(() => {
    if (!newsSeries.length || !hotNews.length) return [];
    const anchor = newsSeries[0];
    const bucketSize = INTERVAL_MS[NEWS_WINDOW_INTERVAL[newsWindow]];
    const first = anchor.candles[0];
    const last = anchor.candles[anchor.candles.length - 1];
    if (!first || !last) return [];

    return groupedNews
      .filter((group) => group.bucket >= first.time && group.bucket <= last.time)
      .map((group) => {
        const ratio = (group.bucket - first.time) / Math.max(1, last.time - first.time);
        return {
          ...group,
          x: PAD_LEFT + ratio * newsChartMeta.drawW,
          laneY: PAD_TOP + 22 + ((group.bucket / bucketSize) % 4) * 12,
        };
      });
  }, [groupedNews, hotNews, newsSeries, newsChartMeta.drawW, newsWindow]);

  const hoveredNewsItem = useMemo(() => {
    if (!hoveredNewsId) return null;
    return hotNews.find((item) => item.id === hoveredNewsId) ?? null;
  }, [hoveredNewsId, hotNews]);

  const activeNewsMarker = useMemo(() => {
    if (!hoveredNewsId) return visibleNewsMarkers[0] ?? null;
    return (
      visibleNewsMarkers.find((marker) => marker.items.some((item) => item.id === hoveredNewsId)) ??
      visibleNewsMarkers[0] ??
      null
    );
  }, [hoveredNewsId, visibleNewsMarkers]);

  const newsAxisTicks = useMemo(() => {
    const anchor = newsSeries[0];
    if (!anchor || anchor.candles.length === 0) return [];
    const total = anchor.candles.length;
    const tickCount = newsWindow === "24H" ? 6 : 5;
    return Array.from({ length: tickCount }, (_, i) => {
      const idx = Math.min(total - 1, Math.round((i / Math.max(1, tickCount - 1)) * (total - 1)));
      return anchor.candles[idx];
    });
  }, [newsSeries, newsWindow]);

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!chartMeta.maxLen || !chartWidth) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD_LEFT;
    const idx = Math.round((mx / chartMeta.drawW) * (chartMeta.maxLen - 1));
    const clamped = Math.max(0, Math.min(chartMeta.maxLen - 1, idx));
    setHoveredIdx(clamped);
  }

  return (
    <div className="min-h-screen">
      <div className="border-b" style={{ borderColor: B }}>
        <SectionLabel eyebrow="Market Relationships" title="Custom Basket" meta={`${lookback} · ${klineInterval} · Perps`} />

        <div className="border-b px-6 py-4 flex flex-col gap-4" style={{ borderColor: B, background: "var(--surface)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
              Compare Window
            </span>
            <div className="flex flex-wrap gap-1">
              {LOOKBACK_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLookback(option)}
                  className="px-2.5 py-1 text-[11px] font-mono border rounded transition-colors"
                  style={{
                    borderColor: lookback === option ? "var(--accent)" : B,
                    background: lookback === option ? "var(--accent-track)" : "transparent",
                    color: lookback === option ? "var(--accent)" : "var(--foreground-dim)",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
              Kline Resolution
            </span>
            <div className="flex flex-wrap gap-1">
              {INTERVAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKlineInterval(option)}
                  className="px-2.5 py-1 text-[11px] font-mono border rounded transition-colors"
                  style={{
                    borderColor: klineInterval === option ? "var(--accent)" : B,
                    background: klineInterval === option ? "var(--accent-track)" : "transparent",
                    color: klineInterval === option ? "var(--accent)" : "var(--foreground-dim)",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
              Pair Selector
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(relationshipData.assets).filter((asset) => ["BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "LINK", "HBAR", "SUI"].includes(asset)).map((asset) => {
                const active = selectedAssets.includes(asset);
                const disableRemoval = active && selectedAssets.length <= 2;
                return (
                  <button
                    key={asset}
                    type="button"
                    disabled={disableRemoval}
                    onClick={() => {
                      setSelectedAssets((current) => {
                        if (current.includes(asset)) {
                          if (current.length <= 2) return current;
                          return current.filter((item) => item !== asset);
                        }
                        return [...current, asset];
                      });
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono border rounded transition-colors disabled:opacity-40"
                    style={{
                      borderColor: active ? (COLORS[asset] ?? "var(--accent)") : B,
                      background: active ? "var(--surface-2)" : "transparent",
                      color: active ? (COLORS[asset] ?? "var(--foreground)") : "var(--foreground-dim)",
                    }}
                  >
                    {asset}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 border-b" style={{ borderColor: B }}>
          <div className="px-6 py-5 border-b md:border-b-0 md:border-r" style={{ borderColor: B }}>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3 font-bold" style={{ color: "var(--foreground-dim)" }}>
              Leader
            </p>
            {!metrics ? <SkeletonBlock lines={2} /> : (
              <>
                <p className="text-[18px] font-mono font-bold" style={{ color: metrics.leader.color }}>{metrics.leader.asset}</p>
                <p className="text-[12px] font-mono mt-1" style={{ color: "var(--foreground-muted)" }}>{fmtPercent(metrics.leader.value)}</p>
              </>
            )}
          </div>
          <div className="px-6 py-5 border-b md:border-b-0 md:border-r" style={{ borderColor: B }}>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3 font-bold" style={{ color: "var(--foreground-dim)" }}>
              Laggard
            </p>
            {!metrics ? <SkeletonBlock lines={2} /> : (
              <>
                <p className="text-[18px] font-mono font-bold" style={{ color: metrics.laggard.color }}>{metrics.laggard.asset}</p>
                <p className="text-[12px] font-mono mt-1" style={{ color: "var(--foreground-muted)" }}>{fmtPercent(metrics.laggard.value)}</p>
              </>
            )}
          </div>
          <div className="px-6 py-5 border-b md:border-b-0 md:border-r" style={{ borderColor: B }}>
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3 font-bold" style={{ color: "var(--foreground-dim)" }}>
              Alignment
            </p>
            {!metrics ? <SkeletonBlock lines={2} /> : (
              <>
                <p className="text-[18px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
                  {metrics.alignedCount} / {metrics.latest.length}
                </p>
                <p className="text-[12px] font-mono mt-1" style={{ color: "var(--foreground-muted)" }}>
                  moving with {activeAsset}
                </p>
              </>
            )}
          </div>
          <div className="px-6 py-5">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3 font-bold" style={{ color: "var(--foreground-dim)" }}>
              Relationship Read
            </p>
            {!metrics ? <SkeletonBlock lines={3} /> : (
              <p className="text-[12px] font-mono leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                {metrics.summary}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y xl:grid-cols-[minmax(0,1fr)_320px] xl:divide-y-0 xl:divide-x" style={{ borderColor: B }}>
          <div className="min-w-0" style={{ background: "var(--background)" }}>
              <div className="border-b px-4 py-3 sm:px-6" style={{ background: "var(--surface-2)", borderColor: B }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Relative Performance
              </span>
            </div>
            <div className="relative min-h-[320px] w-full" ref={containerRef}>
              {loadingSeries ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>Loading relationship data…</span>
                </div>
              ) : series.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>Relationship data unavailable</span>
                </div>
              ) : chartWidth > 0 ? (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ display: "block" }}
                  onMouseMove={onMouseMove}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {chartMeta.yTicks.map((tick, i) => (
                    <line
                      key={i}
                      x1={PAD_LEFT}
                      x2={chartWidth - PAD_RIGHT}
                      y1={chartMeta.toY(tick)}
                      y2={chartMeta.toY(tick)}
                      stroke={GRID}
                      strokeWidth={1}
                    />
                  ))}

                  <line
                    x1={PAD_LEFT}
                    x2={chartWidth - PAD_RIGHT}
                    y1={chartMeta.toY(0)}
                    y2={chartMeta.toY(0)}
                    stroke="var(--foreground-faint)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />

                  {hoveredIdx !== null && (
                    <line
                      x1={chartMeta.toX(hoveredIdx, chartMeta.maxLen)}
                      x2={chartMeta.toX(hoveredIdx, chartMeta.maxLen)}
                      y1={PAD_TOP}
                      y2={CHART_H - PAD_BOT}
                      stroke="#333"
                      strokeWidth={1}
                    />
                  )}

                  {series.map((item) => {
                    const points = item.candles
                      .map((candle, idx) => `${chartMeta.toX(idx, item.candles.length)},${chartMeta.toY(candle.value)}`)
                      .join(" ");
                    return (
                      <polyline
                        key={item.asset}
                        points={points}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={item.asset === activeAsset ? 3 : 1.8}
                        strokeOpacity={item.asset === activeAsset ? 1 : 0.55}
                      />
                    );
                  })}

                  {series.map((item) => {
                    const last = item.candles[item.candles.length - 1];
                    if (!last) return null;
                    return (
                      <text
                        key={item.asset}
                        x={chartWidth - PAD_RIGHT + 8}
                        y={chartMeta.toY(last.value) + 4}
                        fill={item.color}
                        fontSize={11}
                        fontFamily="var(--font-mono)"
                        fontWeight="bold"
                      >
                        {item.asset}
                      </text>
                    );
                  })}

                  {chartMeta.yTicks.map((tick, i) => (
                    <text
                      key={i}
                      x={chartWidth - PAD_RIGHT + 8}
                      y={chartMeta.toY(tick) + 4}
                      fill={LABEL}
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                    >
                      {fmtPercent(tick)}
                    </text>
                  ))}

                  {series[0] && [0, 72, 144, 216, 287].map((idx, i) => {
                    const candle = series[0].candles[Math.min(idx, series[0].candles.length - 1)];
                    if (!candle) return null;
                    return (
                      <text
                        key={i}
                        x={chartMeta.toX(Math.min(idx, series[0].candles.length - 1), chartMeta.maxLen)}
                        y={CHART_H - 8}
                        fill={LABEL}
                        fontSize={10}
                        fontFamily="var(--font-mono)"
                        textAnchor="middle"
                      >
                        {fmtTime(candle.time)}
                      </text>
                    );
                  })}
                </svg>
              ) : null}
            </div>
          </div>

          <div style={{ background: "var(--surface)" }}>
            <div className="border-b px-4 py-3 sm:px-5 sm:py-4" style={{ borderColor: B }}>
              <p className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>
                Relative Strength Ranking
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: B }}>
              {!metrics ? (
                <div className="p-5"><SkeletonBlock lines={5} /></div>
              ) : (
                metrics.latest.map((item, idx) => (
                  <div key={item.asset} className="px-5 py-4 flex items-center justify-between" style={{ borderColor: B }}>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono tabular-nums font-bold" style={{ color: "var(--foreground-faint)" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[13px] font-mono font-bold" style={{ color: item.color }}>{item.asset}</span>
                    </div>
                    <span className="text-[12px] font-mono font-semibold" style={{ color: item.value >= 0 ? "var(--bull)" : "var(--bear)" }}>
                      {fmtPercent(item.value)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel eyebrow="News on Chart" title={`${WAVE_CATEGORY_LABELS[waveCategory]} Wave Map`} meta={`${newsWindow} · ${NEWS_WINDOW_INTERVAL[newsWindow]} · Market-Wide Feed`} />
        <div style={{ borderColor: B }}>
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" style={{ borderColor: B, background: "var(--surface)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Wave Map Filter
              </span>
              <div className="flex flex-wrap gap-1">
                {WAVE_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setWaveCategory(category)}
                    className="px-3 py-1.5 text-[11px] font-mono border rounded transition-colors"
                    style={{
                      borderColor: waveCategory === category ? "var(--accent)" : B,
                      background: waveCategory === category ? "var(--accent-track)" : "transparent",
                      color: waveCategory === category ? "var(--accent)" : "var(--foreground-dim)",
                    }}
                  >
                    {WAVE_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                Chart Window
              </span>
              <div className="flex flex-wrap gap-1">
                {NEWS_WINDOW_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setNewsWindow(option)}
                    className="px-3 py-1.5 text-[11px] font-mono border rounded transition-colors"
                    style={{
                      borderColor: newsWindow === option ? "var(--accent)" : B,
                      background: newsWindow === option ? "var(--accent-track)" : "transparent",
                      color: newsWindow === option ? "var(--accent)" : "var(--foreground-dim)",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[10px] font-mono uppercase tracking-[0.16em] font-semibold" style={{ color: "var(--foreground-faint)" }}>
              {waveAssets.join(" / ")}
            </span>
          </div>

          <div className="min-w-0 border-b" style={{ borderColor: B, background: "#000000" }}>
            <div className="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3" style={{ background: "var(--surface-2)", borderColor: B }}>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: "var(--foreground-dim)" }}>
                {waveAssets.join(" / ")} Wave Map
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--foreground-faint)" }}>
                Hover a signal node to reveal the matching news cluster
              </span>
            </div>
            <div className="relative min-h-[320px] sm:min-h-[420px] w-full overflow-hidden" ref={newsChartRef} style={{ background: "#000000" }}>
              {loadingNewsSeries ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>Loading news map…</span>
                </div>
              ) : newsSeries.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>Wave data unavailable</span>
                </div>
              ) : newsChartWidth > 0 ? (
                <>
                  <svg className="absolute inset-0 h-full w-full" style={{ display: "block" }} onMouseLeave={() => setHoveredNewsId(null)}>
                    {newsChartMeta.yTicks.map((tick, i) => (
                      <line
                        key={i}
                        x1={PAD_LEFT}
                        x2={newsChartWidth - PAD_RIGHT}
                        y1={newsChartMeta.toY(tick)}
                        y2={newsChartMeta.toY(tick)}
                        stroke={GRID}
                        strokeWidth={1}
                      />
                    ))}

                    <line
                      x1={PAD_LEFT}
                      x2={newsChartWidth - PAD_RIGHT}
                      y1={newsChartMeta.toY(0)}
                      y2={newsChartMeta.toY(0)}
                      stroke="var(--foreground-faint)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />

                    {newsSeries.map((item) => {
                      const points = item.candles
                        .map((candle, idx) => `${newsChartMeta.toX(idx, item.candles.length)},${newsChartMeta.toY(candle.value)}`)
                        .join(" ");
                      return (
                        <polyline
                          key={item.asset}
                          points={points}
                          fill="none"
                          stroke={item.color}
                          strokeWidth={3}
                          strokeOpacity={0.9}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}

                    {visibleNewsMarkers.map((marker) => {
                      const active =
                        marker.items.some((item) => item.id === hoveredNewsId) ||
                        (!hoveredNewsId && activeNewsMarker?.bucket === marker.bucket);
                      return (
                        <g
                          key={marker.bucket}
                          onMouseEnter={() => setHoveredNewsId(marker.items[0]?.id ?? null)}
                          onMouseLeave={() => setHoveredNewsId(null)}
                          style={{ cursor: "pointer" }}
                        >
                          <rect
                            x={marker.x - 8}
                            y={PAD_TOP + 6}
                            width={16}
                            height={NEWS_CHART_H - PAD_TOP - PAD_BOT + 10}
                            fill="transparent"
                          />
                          <line
                            x1={marker.x}
                            x2={marker.x}
                            y1={marker.laneY}
                            y2={NEWS_CHART_H - PAD_BOT - 14}
                            stroke={active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)"}
                            strokeWidth={1}
                            strokeDasharray="4 5"
                          />
                          <circle
                            cx={marker.x}
                            cy={marker.laneY}
                            r={active ? 5 : 4}
                            fill={active ? "var(--accent)" : "#9a9a9a"}
                            stroke="#000000"
                            strokeWidth={active ? 1.5 : 1}
                          />
                          {marker.itemCount > 1 && (
                            <text
                              x={marker.x}
                              y={marker.laneY - 10}
                              textAnchor="middle"
                              fill={active ? "var(--accent)" : "rgba(255,255,255,0.5)"}
                              fontSize={7}
                              fontFamily="var(--font-mono)"
                              fontWeight="bold"
                            >
                              {marker.itemCount}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {newsSeries.map((item) => {
                      const last = item.candles[item.candles.length - 1];
                      if (!last) return null;
                      return (
                        <text
                          key={item.asset}
                          x={newsChartWidth - PAD_RIGHT + 8}
                          y={newsChartMeta.toY(last.value) + 4}
                          fill={item.color}
                          fontSize={11}
                          fontFamily="var(--font-mono)"
                          fontWeight="bold"
                        >
                          {item.asset}
                        </text>
                      );
                    })}

                    {newsAxisTicks.map((candle, i) => {
                      const idx = newsSeries[0].candles.findIndex((point) => point.time === candle.time);
                      return (
                        <text
                          key={i}
                          x={newsChartMeta.toX(Math.max(0, idx), newsChartMeta.maxLen)}
                          y={NEWS_CHART_H - 8}
                          fill={LABEL}
                          fontSize={10}
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                        >
                          {fmtAxisTime(candle.time, newsWindow)}
                        </text>
                      );
                    })}
                  </svg>

                  {activeNewsMarker && (
                    <div
                      className="absolute left-3 right-3 top-3 z-10 max-w-[360px] rounded-2xl border p-3 shadow-2xl backdrop-blur-md sm:left-4 sm:right-auto sm:top-4 sm:p-4"
                      style={{
                        borderColor: "rgba(255,255,255,0.12)",
                        background: "rgba(8,8,8,0.94)",
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--foreground-faint)" }}>
                            News Cluster
                          </p>
                          <p className="text-[12px] font-mono font-semibold" style={{ color: "var(--foreground-dim)" }}>
                            {new Date(activeNewsMarker.bucket).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em]"
                          style={{
                            color: "var(--accent)",
                            background: "var(--accent-track)",
                          }}
                        >
                          {activeNewsMarker.itemCount} headline{activeNewsMarker.itemCount > 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {activeNewsMarker.items.slice(0, 3).map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded-xl border px-3 py-2 text-left transition-colors"
                            style={{
                              borderColor: hoveredNewsId === item.id ? "var(--accent)" : "rgba(255,255,255,0.08)",
                              background: hoveredNewsId === item.id ? "rgba(255,166,0,0.08)" : "rgba(255,255,255,0.02)",
                            }}
                            onMouseEnter={() => setHoveredNewsId(item.id)}
                            onClick={() => item.source_link && window.open(item.source_link, "_blank")}
                          >
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--foreground-faint)" }}>
                                {idx === 0 ? "Lead" : `Follow ${idx}`}
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: "var(--foreground-dim)" }}>
                                {fmtTime(item.timestamp_ms)}
                              </span>
                            </div>
                            <p className="text-[12px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
                              {displayNewsTitle(item)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px lg:grid-cols-2" style={{ background: B }}>
            <div style={{ background: "var(--surface)" }}>
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4" style={{ borderColor: B }}>
                <p className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>
                  Major Headlines
                </p>
              </div>

              <div className="max-h-[360px] sm:max-h-[420px] overflow-y-auto">
                {loadingNews ? (
                  <div className="p-5"><SkeletonBlock lines={5} /></div>
                ) : !hotNews.length ? (
                  <div className="p-5">
                    <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: "var(--foreground-faint)" }}>
                      No major headlines found
                    </p>
                  </div>
                ) : (
                  majorHeadlines.map((item) => {
                    const active = hoveredNewsId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full border-b px-5 py-4 text-left transition-colors"
                        style={{
                          borderColor: B,
                          background: active ? "var(--surface-2)" : "transparent",
                        }}
                        onMouseEnter={() => setHoveredNewsId(item.id)}
                        onMouseLeave={() => setHoveredNewsId(null)}
                        onClick={() => item.source_link && window.open(item.source_link, "_blank")}
                      >
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>
                            {new Date(item.timestamp_ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                          <span
                            className="rounded-full px-2 py-1 text-[9px] font-mono uppercase tracking-widest"
                            style={{
                              color: active ? "var(--accent)" : "var(--foreground-faint)",
                              background: active ? "var(--accent-track)" : "var(--surface-2)",
                            }}
                          >
                            on chart
                          </span>
                        </div>
                        <p className="text-[13px] font-bold leading-snug" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
                          {displayNewsTitle(item)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ background: "var(--surface)" }}>
              <div className="border-b px-4 py-3 sm:px-5 sm:py-4" style={{ borderColor: B }}>
                <p className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>
                  Recent Headlines
                </p>
              </div>

              <div className="max-h-[360px] sm:max-h-[420px] overflow-y-auto">
                {loadingNews ? (
                  <div className="p-5"><SkeletonBlock lines={6} /></div>
                ) : !hotNews.length ? (
                  <div className="p-5">
                    <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: "var(--foreground-faint)" }}>
                      No recent headlines found
                    </p>
                  </div>
                ) : (
                  hotNews.map((item) => {
                    const active = hoveredNewsId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full border-b px-5 py-4 text-left transition-colors"
                        style={{
                          borderColor: B,
                          background: active ? "var(--surface-2)" : "transparent",
                        }}
                        onMouseEnter={() => setHoveredNewsId(item.id)}
                        onMouseLeave={() => setHoveredNewsId(null)}
                        onClick={() => item.source_link && window.open(item.source_link, "_blank")}
                      >
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>
                            {new Date(item.timestamp_ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                          {item.is_major && (
                            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                              major
                            </span>
                          )}
                        </div>
                        <p className="mb-2 text-[12px] font-semibold leading-snug" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
                          {displayNewsTitle(item)}
                        </p>
                        {item.content_excerpt && (
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                            {item.content_excerpt}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
