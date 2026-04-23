"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import relationshipData from "@/market_relationship.json";
import { PriceChart } from "./price-chart";

interface SeriesData {
  asset: string;
  candles: { time: number; value: number }[];
  color: string;
}

interface NewsItem {
  id: string;
  title: string | null;
  content: string;
  release_time: number;
  source_link: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7", "#ec4899", "#f97316"];
const B = "var(--border-subtle)";
const GRID = "#161616";
const LABEL = "#444444";

const PAD_TOP = 8;
const PAD_BOT = 28;
const PAD_LEFT = 0;
const PAD_RIGHT = 84;
const CHART_H = 280;

const LOOKBACKS = ["12H", "1D", "3D", "1W", "1M", "3M"] as const;
type Lookback = typeof LOOKBACKS[number];

const LOOKBACK_MINS: Record<Lookback, number> = {
  "12H": 12 * 60,
  "1D": 24 * 60,
  "3D": 3 * 24 * 60,
  "1W": 7 * 24 * 60,
  "1M": 30 * 24 * 60,
  "3M": 90 * 24 * 60,
};

const INTERVAL_MINS: Record<string, number> = {
  "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60,
  "4h": 240, "8h": 480, "12h": 720, "1D": 1440,
  "3D": 4320, "1W": 10080, "1M": 43200
};

function fmtTime(ts: number, lookback: Lookback) {
  const date = new Date(ts);
  if (lookback === "12H" || lookback === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function SectionLabel({ eyebrow, title }: { eyebrow: string; title?: string }) {
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
    </div>
  );
}

export function NewsMappingModule({ asset: initialAsset }: { asset: string }) {
  const [anchorAsset, setAnchorAsset] = useState(initialAsset);
  const [marketType, setMarketType] = useState<"perps" | "spot">("perps");
  const [lookback, setLookback] = useState<Lookback>("1W");
  const [interval, setInterval] = useState("1h");
  const [series, setSeries] = useState<SeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [hotNews, setHotNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [hoveredNewsId, setHoveredNewsId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const major5 = ["BTC", "ETH", "SOL", "XRP", "ADA"];

  // Resize observer for chart width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartWidth(el.clientWidth));
    ro.observe(el);
    setChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sodexIntervals = relationshipData.sodex.intervals[marketType];

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    const fetchAll = async () => {
      const rawLimit = Math.ceil(LOOKBACK_MINS[lookback] / (INTERVAL_MINS[interval] || 60));
      const limit = Math.max(10, Math.min(rawLimit, 1500));
      const templates = relationshipData.sodex.kline_templates;
      const template = templates[marketType];

      const requests = major5.map(async (a, i) => {
        const config = relationshipData.assets[a as keyof typeof relationshipData.assets];
        if (!config) return null;

        const symbol = config.suggested_sodex_symbols[marketType][0];
        if (!symbol) return null;

        const url = template.replace("{symbol}", symbol).replace("{interval}", interval).replace("{limit}", String(limit));

        try {
          const r = await fetch(url);
          const json = await r.json();
          if (json.code !== 0 || !json.data) return null;

          const sorted = [...json.data].sort((a: any, b: any) => a.t - b.t);
          if (sorted.length === 0) return null;

          const firstClose = parseFloat(sorted[0].c);
          const candles = sorted.map((k: any) => ({
            time: k.t,
            value: ((parseFloat(k.c) - firstClose) / firstClose) * 100
          }));

          return {
            asset: a,
            candles,
            color: COLORS[i % COLORS.length]
          };
        } catch (e) {
          return null;
        }
      });

      const results = await Promise.all(requests);
      if (ignore) return;

      setSeries(results.filter((s): s is SeriesData => s !== null));
      setLoading(false);
    };
    3arketType, lookback, interval]);

  // Fetch Hot News (7 days)
  useEffect(() => {
    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        const response = await fetch("https://api.sosovalue.xyz/openapi/v1/news/hot?pageSize=100");
        const json = await response.json();
        const items = json?.data?.list ?? [];
        setHotNews(items.map((it: any) => ({
          ...it,
          release_time: Number(it.release_time)
        })));
      } catch (err) {
        console.error("Failed to fetch hot news:", err);
      } finally {
        setLoadingNews(false);
      }
    };

    fetchNews();
    const intervalId = setInterval(fetchNews, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Charting math for performance chart
  const allValues = series.flatMap(s => s.candles.map(c => c.value));
  const minVal = allValues.length ? Math.min(...allValues) : -1;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;
  const pad = range * 0.06;
  const yMin = minVal - pad;
  const yMax = maxVal + pad;

  const minCandleW = 8;
  const contentW = Math.max(width, maxLen * minCandleW + PAD_LEFT + PAD_RIGHT);
  const drawW = Math.max(0, contentW - PAD_LEFT - PAD_RIGHT);
  const drawH = CHART_H - PAD_TOP - PAD_BOT;

  const toX = (i: number, total: number) => PAD_LEFT + (i / (total - 1 || 1)) * drawW;
  const toY = (v: number) => PAD_TOP + drawH - ((v - yMin) / (yMax - yMin)) * drawH;

  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + (yMax - yMin) * (i / 3));
  const xTicks = Array.from({ length: Math.max(5, Math.floor(contentW / 120)) }, (_, i) =>
    Math.round((i / (Math.max(5, Math.floor(contentW / 120)) - 1)) * (maxLen - 1))
  );

  // News Markers Logic
  const newsMarkers = useMemo(() => {
    if (series.length === 0 || hotNews.length === 0) return [];
    const firstCandle = series[0].candles[0];
    const lastCandle = series[0].candles[series[0].candles.length - 1];
    if (!firstCandle || !lastCandle) return [];

    const startTs = firstCandle.time;
    const endTs = lastCandle.time;

    return hotNews.filter(n => n.release_time >= startTs && n.release_time <= endTs)
      .map(n => {
        // Use linear time interpolation for better spacing
        const ratio = (n.release_time - startTs) / (endTs - startTs);
        return { ...n, x: PAD_LEFT + ratio * drawW };
      });
  }, [series, hotNews, maxLen, drawW]);

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!maxLen || !width) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD_LEFT;
    const idx = Math.round((mx / drawW) * (maxLen - 1));
    const clamped = Math.max(0, Math.min(maxLen - 1, idx));
    setHoveredIdx(clamped);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <SectionLabel eyebrow="News Mapping" title="Macro Correlator" />

      {/* Controls */}
      <div className="flex items-center gap-4 px-6 py-4 border-b" style={{ background: "var(--surface-2)", borderColor: B }}>
        <div className="flex items-center gap-2 pr-4 border-r" style={{ borderColor: B }}>
          <span className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>Anchor:</span>
          <div className="flex bg-background border rounded p-0.5" style={{ borderColor: B }}>
            {major5.map(a => (
              <button
                key={a}
                onClick={() => setAnchorAsset(a)}
                className="px-2.5 py-1 text-[11px] font-mono rounded transition-colors"
                style={{
                  background: anchorAsset === a ? "var(--surface-3)" : "transparent",
                  color: anchorAsset === a ? "var(--foreground)" : "var(--foreground-dim)",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pr-4 border-r" style={{ borderColor: B }}>
          <span className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>Period:</span>
          <div className="flex bg-background border rounded p-0.5" style={{ borderColor: B }}>
            {LOOKBACKS.map(lb => (
              <button
                key={lb}
                onClick={() => setLookback(lb)}
                className="px-2.5 py-1 text-[11px] font-mono rounded transition-colors"
                style={{
                  background: lookback === lb ? "var(--surface-3)" : "transparent",
                  color: lookback === lb ? "var(--foreground)" : "var(--foreground-dim)",
                }}
              >
                {lb}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 items-center">
          <span className="text-[11px] font-mono uppercase tracking-widest font-bold mr-1" style={{ color: "var(--foreground-dim)" }}>Resolution:</span>
          {sodexIntervals.slice(0, 5).map(i => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className="px-2 py-1 text-[10px] font-mono border rounded transition-colors"
              style={{
                borderColor: interval === i ? "var(--accent)" : B,
                background: interval === i ? "var(--accent-track)" : "transparent",
                color: interval === i ? "var(--accent)" : "var(--foreground-dim)"
              }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] divide-y xl:divide-y-0 xl:divide-x" style={{ borderColor: B, flex: 1 }}>

        {/* Left: Dual Charts */}
        <div className="flex flex-col relative" style={{ background: "var(--background)" }}>
          {/* Top: Kline Chart */}
          <div className="border-b" style={{ borderColor: B }}>
            <PriceChart
              asset={anchorAsset}
              newsMarkers={hotNews}
              hoveredNewsId={hoveredNewsId}
              onNewsHover={setHoveredNewsId}
            />
          </div>

          <div className="px-6 py-3 border-b flex items-center justify-between" style={{ background: "var(--surface-2)", borderColor: B }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-foreground-dim">
              Basket News Mapping · Relative Delta
            </span>
            <div className="flex gap-4">
              {series.map(s => (
                <div key={s.asset} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: s.color }}>{s.asset}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-[300px]" ref={containerRef}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono uppercase tracking-widest animate-pulse" style={{ color: LABEL }}>Mapping Price Relations…</span>
              </div>
            ) : series.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>No data for mapping</span>
              </div>
            ) : width > 0 ? (
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ display: "block" }}
                onMouseMove={onMouseMove}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Grid */}
                {yTicks.map((tick, i) => (
                  <line key={i} x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={toY(tick)} y2={toY(tick)} stroke={GRID} strokeWidth={1} />
                ))}

                {/* Zero line */}
                <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={toY(0)} y2={toY(0)} stroke="var(--foreground-faint)" strokeWidth={1} strokeDasharray="4 4" />

                {/* News Markers */}
                {newsMarkers.map((m) => (
                  <g
                    key={m.id}
                    onMouseEnter={() => setHoveredNewsId(m.id)}
                    onMouseLeave={() => setHoveredNewsId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{m.title || m.content.substring(0, 50) + "..."}</title>
                    <line
                      x1={m.x} x2={m.x} y1={PAD_TOP} y2={drawH}
                      stroke={hoveredNewsId === m.id ? "var(--accent)" : "rgba(255,180,0,0.15)"}
                      strokeWidth={hoveredNewsId === m.id ? 2 : 1}
                      strokeDasharray={hoveredNewsId === m.id ? "none" : "4 4"}
                    />
                    <rect
                      x={m.x - 8} cy={PAD_TOP} width={16} height={16} rx={2}
                      y={PAD_TOP}
                      fill={hoveredNewsId === m.id ? "var(--accent)" : "rgba(255,180,0,0.3)"}
                    />
                    <text
                      x={m.x} y={PAD_TOP + 12}
                      textAnchor="middle"
                      fill="white"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      fontWeight="bold"
                    >
                      N
                    </text>
                  </g>
                ))}

                {/* Lines */}
                {series.map(s => {
                  const points = s.candles.map((c, i) => `${toX(i, s.candles.length)},${toY(c.value)}`).join(" ");
                  return (
                    <polyline
                      key={s.asset}
                      points={points}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.asset === anchorAsset ? 3 : 1.5}
                      strokeOpacity={s.asset === anchorAsset ? 1 : 0.4}
                      className="transition-all duration-500"
                    />
                  );
                })}

                {/* Asset labels */}
                {series.map(s => {
                  const last = s.candles[s.candles.length - 1];
                  if (!last) return null;
                  return (
                    <text key={s.asset} x={width - PAD_RIGHT + 44} y={toY(last.value) + 4} fill={s.color} fontSize={11} fontFamily="var(--font-mono)" fontWeight="bold">
                      {s.asset}
                    </text>
                  );
                })}

                {/* Y-axis labels */}
                {yTicks.map((tick, i) => (
                  <text key={i} x={width - PAD_RIGHT + 6} y={toY(tick) + 4} fill={LABEL} fontSize={10} fontFamily="var(--font-mono)" textAnchor="start">
                    {tick > 0 ? "+" : ""}{tick.toFixed(2)}%
                  </text>
                ))}

                {/* X-axis labels */}
                {series[0] && xTicks.map((idx, i) => {
                  const candle = series[0].candles[idx];
                  if (!candle) return null;
                  return (
                    <text key={i} x={toX(idx, maxLen)} y={drawH + PAD_BOT - 6} fill={LABEL} fontSize={10} fontFamily="var(--font-mono)" textAnchor="middle">
                      {fmtTime(candle.time, lookback)}
                    </text>
                  );
                })}
              </svg>
            ) : null}
          </div>
        </div>

        {/* Right: Hot News Sidebar */}
        <div className="flex flex-col bg-surface overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: B }}>
            <h3 className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>7D Hot News</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Live Correlator</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loadingNews ? (
              <div className="p-6 space-y-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-24 bg-surface-2 rounded animate-pulse" />
                    <div className="h-10 w-full bg-surface-2 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: B }}>
                {hotNews.map((item) => {
                  const isHovered = hoveredNewsId === item.id;
                  const displayTitle = item.title || (item.content.length > 80 ? item.content.substring(0, 80) + "..." : item.content);

                  return (
                    <div
                      key={item.id}
                      className="p-5 transition-colors cursor-pointer group"
                      style={{ background: isHovered ? "var(--surface-2)" : "transparent" }}
                      onMouseEnter={() => setHoveredNewsId(item.id)}
                      onMouseLeave={() => setHoveredNewsId(null)}
                      onClick={() => item.source_link && window.open(item.source_link, "_blank")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-foreground-dim uppercase tracking-wider font-bold">
                          {new Date(item.release_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {item.source_link && (
                          <span className="text-[9px] font-mono text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            Open ↗
                          </span>
                        )}
                      </div>
                      <h4 className="text-[13px] font-bold leading-snug mb-2 transition-colors" style={{ color: isHovered ? "var(--accent)" : "var(--foreground)" }}>
                        {displayTitle}
                      </h4>
                      <p className="text-[11px] text-foreground-muted line-clamp-3 leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
