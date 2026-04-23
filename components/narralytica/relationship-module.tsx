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
const CHART_H = 260; // Reduced height for stacked view

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

function fmtTime(ts: number) {

  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
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

export function RelationshipModule({ asset: globalAsset }: { asset: string }) {
  const [anchorAsset, setAnchorAsset] = useState(globalAsset);
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

  // Resize observer for chart width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartWidth(el.clientWidth));
    ro.observe(el);
    setChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const allAvailableAssets = Object.keys(relationshipData.assets);
  const assetConfig = relationshipData.assets[anchorAsset as keyof typeof relationshipData.assets];
  
  const relatedAssets = useMemo(() => {
    // For the Relationship section, the user wants the Major 5 tokens
    return ["BTC", "ETH", "SOL", "XRP", "ADA"];
  }, []);

  const sodexIntervals = relationshipData.sodex.intervals[marketType];

  function handleLookbackChange(lb: Lookback) {
    setLookback(lb);
    const targetCandles = 150; // ideal chart resolution
    const targetIntervalMins = LOOKBACK_MINS[lb] / targetCandles;
    
    let bestInterval = sodexIntervals[0];
    let minDiff = Infinity;
    for (const inv of sodexIntervals) {
      const diff = Math.abs(INTERVAL_MINS[inv] - targetIntervalMins);
      if (diff < minDiff) {
        minDiff = diff;
        bestInterval = inv;
      }
    }
    setInterval(bestInterval);
  }

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    const fetchAll = async () => {
      // Balance limit based on selected lookback and interval
      const rawLimit = Math.ceil(LOOKBACK_MINS[lookback] / (INTERVAL_MINS[interval] || 60));
      const limit = Math.max(10, Math.min(rawLimit, 1500)); // cap to max 1500
      
      const templates = relationshipData.sodex.kline_templates;
      const template = templates[marketType];

      const requests = relatedAssets.map(async (a, i) => {
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

    fetchAll();
    return () => { ignore = true; };
  }, [anchorAsset, marketType, lookback, interval, relatedAssets]);

  // Fetch Hot News
  useEffect(() => {
    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        const response = await fetch("https://api.sosovalue.xyz/openapi/v1/news/hot");
        const json = await response.json();
        const items = json?.data?.list ?? [];
        setHotNews(items);
      } catch (err) {
        console.error("Failed to fetch hot news:", err);
      } finally {
        setLoadingNews(false);
      }
    };

    fetchNews();
    const intervalId = setInterval(fetchNews, 60000); // refresh every minute
    return () => clearInterval(intervalId);
  }, []);

  // Charting math
  const allValues = series.flatMap(s => s.candles.map(c => c.value));
  const minVal = allValues.length ? Math.min(...allValues) : -1;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const range = maxVal - minVal || 1;
  const pad = range * 0.06;
  const yMin = minVal - pad;
  const yMax = maxVal + pad;

  const width = Math.max(0, chartWidth);
  const drawW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const drawH = CHART_H - PAD_TOP - PAD_BOT;

  const maxLen = series.reduce((m, s) => Math.max(m, s.candles.length), 0);
  const toX = (i: number, total: number) => PAD_LEFT + (i / (total - 1 || 1)) * drawW;
  const toY = (v: number) => PAD_TOP + drawH - ((v - yMin) / (yMax - yMin)) * drawH;

  // Ticks
  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + (yMax - yMin) * (i / 3));
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i / (xTickCount - 1)) * (maxLen - 1))
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
        // Find closest candle index
        let closestIdx = 0;
        let minDiff = Infinity;
        series[0].candles.forEach((c, i) => {
          const diff = Math.abs(c.time - n.release_time);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        });
        return { ...n, x: toX(closestIdx, maxLen) };
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

  // Intelligence Logic
  const metrics = useMemo(() => {
    if (series.length < 2) return null;
    
    const sorted = [...series].sort((a, b) => {
      const aLast = a.candles[a.candles.length - 1]?.value || 0;
      const bLast = b.candles[b.candles.length - 1]?.value || 0;
      return bLast - aLast; // Descending
    });

    const leader = sorted[0];
    const laggard = sorted[sorted.length - 1];
    
    const anchorSeries = series.find(s => s.asset === anchorAsset);
    const anchorPerf = anchorSeries?.candles.slice(-1)[0]?.value || 0;
    const isAnchorBullish = anchorPerf >= 0;

    const bullishCount = series.filter(s => (s.candles.slice(-1)[0]?.value || 0) >= 0).length;
    const bearishCount = series.length - bullishCount;
    
    const majorityDirection = bullishCount > bearishCount ? "bullish" : bullishCount < bearishCount ? "bearish" : "mixed";
    
    let divergence = null;
    if (Math.abs(anchorPerf) > 0.5) {
      if (isAnchorBullish && majorityDirection === "bearish") {
        divergence = `${anchorAsset} is diverging bullish against a weak basket.`;
      } else if (!isAnchorBullish && majorityDirection === "bullish") {
        divergence = `${anchorAsset} is diverging bearish against a strong basket.`;
      }
    }

    const alignedCount = isAnchorBullish ? bullishCount : bearishCount;
    const confirmationStrength = alignedCount / series.length;
    
    let summarySentence = "";
    if (divergence) {
      summarySentence = divergence;
    } else if (confirmationStrength >= 0.8) {
      summarySentence = `Broad confirmation: ${anchorAsset} is moving in sync with the basket.`;
    } else if (confirmationStrength <= 0.4) {
      summarySentence = `Weak confirmation: The move in ${anchorAsset} is isolated.`;
    } else {
      summarySentence = `${anchorAsset} is seeing mixed confirmation from related pairs.`;
    }

    return {
      sorted,
      leader,
      laggard,
      anchorPerf,
      alignedCount,
      majorityDirection,
      divergence,
      summarySentence,
      totalCount: series.length
    };
  }, [series, anchorAsset]);

  return (
    <div className="flex flex-col min-h-screen">
      <SectionLabel eyebrow="Market Relationships" title={anchorAsset} />
      
      {/* Controls */}
      <div className="flex flex-col gap-px" style={{ background: B }}>
        {/* Anchor Selector */}
        <div className="flex items-center gap-4 px-6 py-3" style={{ background: "var(--surface)", borderColor: B }}>
          <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>
            Anchor:
          </span>
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
            {allAvailableAssets.map(a => (
              <button
                key={a}
                onClick={() => setAnchorAsset(a)}
                className="px-3 py-1 text-[11px] font-mono border rounded transition-colors whitespace-nowrap"
                style={{
                  borderColor: anchorAsset === a ? "var(--accent)" : B,
                  background: anchorAsset === a ? "var(--accent-track)" : "var(--surface-2)",
                  color: anchorAsset === a ? "var(--foreground)" : "var(--foreground-muted)"
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-4 px-6 py-4" style={{ background: "var(--surface-2)" }}>
          {/* Lookback Selector */}
          <div className="flex items-center gap-2 pr-4 border-r" style={{ borderColor: B }}>
            <span className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>Period:</span>
            <div className="flex bg-background border rounded p-0.5" style={{ borderColor: B }}>
              {LOOKBACKS.map(lb => (
                <button
                  key={lb}
                  onClick={() => handleLookbackChange(lb)}
                  className="px-2.5 py-1 text-[11px] font-mono rounded transition-colors"
                  style={{
                    background: lookback === lb ? "var(--surface-3)" : "transparent",
                    color: lookback === lb ? "var(--foreground)" : "var(--foreground-dim)",
                    fontWeight: lookback === lb ? "bold" : "normal"
                  }}
                >
                  {lb}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar items-center">
            <span className="text-[11px] font-mono uppercase tracking-widest font-bold mr-1" style={{ color: "var(--foreground-dim)" }}>Resolution:</span>
            {sodexIntervals.slice(0, 9).map(i => (
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
          
          <div className="ml-auto flex items-center gap-4">
            <div className="flex bg-background border rounded p-0.5" style={{ borderColor: B }}>
              {(["perps", "spot"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMarketType(t)}
                  className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded transition-colors"
                  style={{
                    background: marketType === t ? "var(--surface-3)" : "transparent",
                    color: marketType === t ? "var(--foreground)" : "var(--foreground-dim)"
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] divide-y xl:divide-y-0 xl:divide-x" style={{ borderColor: B, flex: 1 }}>
        
        {/* Left: Chart */}
        <div className="flex flex-col relative" style={{ background: "var(--background)" }}>
          {metrics && (
            <div className="absolute top-6 left-6 z-10 px-4 py-2 border backdrop-blur-sm" style={{ borderColor: B, background: "var(--surface)/80" }}>
              <span className="text-[13px] font-mono leading-relaxed" style={{ color: "var(--foreground)" }}>
                {metrics.summarySentence}
              </span>
            </div>
          )}

          {/* Top: Dedicated Kline Chart */}
          <div className="border-b" style={{ borderColor: B }}>
            <PriceChart 
              asset={anchorAsset} 
              newsMarkers={hotNews} 
              hoveredNewsId={hoveredNewsId}
              onNewsHover={setHoveredNewsId}
            />
          </div>

          <div className="px-6 py-3 border-b" style={{ background: "var(--surface-2)", borderColor: B }}>
             <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-foreground-dim">
               Relative Performance Basket
             </span>
          </div>

          <div className="flex-1 w-full relative min-h-[260px]" ref={containerRef}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono uppercase tracking-widest animate-pulse" style={{ color: LABEL }}>Aggregating Data…</span>
              </div>
            ) : series.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: LABEL }}>No related data found</span>
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
                  <line
                    key={i}
                    x1={PAD_LEFT}
                    x2={width - PAD_RIGHT}
                    y1={toY(tick)}
                    y2={toY(tick)}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                ))}
                
                {/* Zero line */}
                <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={toY(0)} y2={toY(0)} stroke="var(--foreground-faint)" strokeWidth={1} strokeDasharray="4 4" />

                {/* Crosshair */}
                {hoveredIdx !== null && (
                  <>
                    <line 
                      x1={toX(hoveredIdx, maxLen)} 
                      x2={toX(hoveredIdx, maxLen)} 
                      y1={PAD_TOP} 
                      y2={CHART_H - PAD_BOT}
                      stroke="#333" 
                      strokeWidth={1} 
                    />
                  </>
                )}

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
                      strokeOpacity={s.asset === anchorAsset ? 1 : 0.5}
                      className="transition-all duration-500"
                    />
                  );
                })}

                {/* News Markers */}
                {newsMarkers.map((m) => (
                  <g 
                    key={m.id} 
                    onMouseEnter={() => setHoveredNewsId(m.id)}
                    onMouseLeave={() => setHoveredNewsId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <line 
                      x1={m.x} 
                      x2={m.x} 
                      y1={PAD_TOP} 
                      y2={CHART_H - PAD_BOT} 
                      stroke={hoveredNewsId === m.id ? "var(--accent)" : "rgba(255,255,255,0.15)"} 
                      strokeWidth={hoveredNewsId === m.id ? 2 : 1}
                      strokeDasharray="4 2"
                    />
                    <circle 
                      cx={m.x} 
                      cy={PAD_TOP + 10} 
                      r={hoveredNewsId === m.id ? 5 : 3} 
                      fill={hoveredNewsId === m.id ? "var(--accent)" : "rgba(255,255,255,0.3)"} 
                    />
                  </g>
                ))}

                {/* Asset labels at the end */}
                {series.map(s => {
                  const last = s.candles[s.candles.length - 1];
                  if (!last) return null;
                  return (
                    <text
                      key={s.asset}
                      x={width - PAD_RIGHT + 44}
                      y={toY(last.value) + 4}
                      fill={s.color}
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      fontWeight="bold"
                    >
                      {s.asset}
                    </text>
                  );
                })}

                {/* Y-axis labels (percentages) */}
                {yTicks.map((tick, i) => (
                  <text key={i} x={width - PAD_RIGHT + 6} y={toY(tick) + 4}
                    fill={LABEL} fontSize={10} fontFamily="var(--font-mono)" textAnchor="start">
                    {tick > 0 ? "+" : ""}{tick.toFixed(2)}%
                  </text>
                ))}

                {/* X-axis labels (time) */}
                {series[0] && xTicks.map((idx, i) => {
                  const candle = series[0].candles[idx];
                  if (!candle) return null;
                  return (
                    <text key={i} x={toX(idx, maxLen)} y={CHART_H - 6}
                      fill={LABEL} fontSize={10} fontFamily="var(--font-mono)" textAnchor="middle">
                      {fmtTime(candle.time)}
                    </text>
                  );
                })}

                {/* Hover tooltip */}
                {hoveredIdx !== null && (() => {
                  const tipX = Math.min(toX(hoveredIdx, maxLen) + 10, width - 150);
                  const tipY = PAD_TOP + 10;
                  const time = series[0]?.candles[hoveredIdx]?.time;
                  
                  return (
                    <g>
                      <rect x={tipX} y={tipY} width={130} height={20 + series.length * 16} rx={3}
                        fill="#0d0d0d" stroke="#222" strokeWidth={1} />
                      {time && (
                        <text x={tipX + 10} y={tipY + 16} fill="#555" fontSize={10} fontFamily="var(--font-mono)">
                          {fmtTime(time)}
                        </text>
                      )}
                      {series.map((s, i) => {
                        const val = s.candles[hoveredIdx]?.value;
                        if (val === undefined) return null;
                        return (
                          <g key={s.asset}>
                            <circle cx={tipX + 14} cy={tipY + 30 + i * 16 - 3} r={3} fill={s.color} />
                            <text x={tipX + 22} y={tipY + 30 + i * 16} fill="#aaa" fontSize={10} fontFamily="var(--font-mono)" fontWeight="bold">
                              {s.asset}
                            </text>
                            <text x={tipX + 120} y={tipY + 30 + i * 16} fill={val >= 0 ? "var(--bull)" : "var(--bear)"} fontSize={10} fontFamily="var(--font-mono)" textAnchor="end">
                              {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

              </svg>
            ) : null}
          </div>
        </div>

        {/* Right: Hot News Sidebar */}
        <div className="flex flex-col bg-surface overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: B }}>
            <h3 className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--foreground-dim)" }}>Hot News</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Live Feed</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loadingNews ? (
              <div className="p-6 space-y-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-24 bg-surface-2 rounded animate-pulse" />
                    <div className="h-10 w-full bg-surface-2 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : hotNews.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-[11px] font-mono uppercase tracking-widest text-foreground-faint">No news available</span>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: B }}>
                {hotNews.map((item) => {
                  const isHovered = hoveredNewsId === item.id;
                  const displayTitle = item.title || (item.content.length > 60 ? item.content.substring(0, 60) + "..." : item.content);
                  
                  return (
                    <div 
                      key={item.id}
                      className="p-5 transition-colors cursor-pointer group"
                      style={{ 
                        background: isHovered ? "var(--surface-2)" : "transparent",
                      }}
                      onMouseEnter={() => setHoveredNewsId(item.id)}
                      onMouseLeave={() => setHoveredNewsId(null)}
                      onClick={() => item.source_link && window.open(item.source_link, "_blank")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-foreground-dim uppercase tracking-wider font-bold">
                          {new Date(item.release_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {item.source_link && (
                          <span className="text-[9px] font-mono text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            View Source ↗
                          </span>
                        )}
                      </div>
                      <h4 
                        className="text-[13px] font-bold leading-snug mb-2 transition-colors"
                        style={{ color: isHovered ? "var(--accent)" : "var(--foreground)" }}
                      >
                        {displayTitle}
                      </h4>
                      <p className="text-[11px] text-foreground-muted line-clamp-2 leading-relaxed">
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
