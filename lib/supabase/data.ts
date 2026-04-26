import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetKey =
  | "btc"
  | "eth"
  | "sol"
  | "xrp"
  | "ada"
  | "doge"
  | "avax"
  | "link"
  | "hbar"
  | "sui"
  | "bnb";

export type ComponentState = "bullish" | "bearish" | "neutral" | "unavailable";
export type MarketBias = "long" | "short" | "neutral";
export type Conviction = "low" | "medium" | "high";
export type Action = "wait" | "spot_long" | "perps_long" | "perps_short";

export interface ComponentCard {
  name: string;
  state: ComponentState;
  score: number;
  score_display: number | string;
  visual_score: number;
  summary: string;
  calc_hint: string;
  evidence: Record<string, unknown>;
}

export interface DecisionAsset {
  asset: string;
  snapshot_time_utc?: string;
  reference_price: number | null;
  reference_price_date: string | null;
  price_source?: string | null;
  overall_signal: ComponentState;
  total_score: number;
  action: Action;
  market_bias: MarketBias;
  conviction: Conviction;
  position_size_bucket: "small" | "medium" | "large";
  updated_at: string;
  signal_story: {
    asset: string;
    updated_at: string;
    headline: { title: string; summary: string };
    component_cards: ComponentCard[];
    decision_summary: {
      action: Action;
      market_bias: MarketBias;
      conviction: Conviction;
      setup: string;
      position_size_bucket: string;
      summary: string;
    };
    evidence: {
      total_score: number;
      overall_signal: ComponentState;
      supporting_components: string[];
      opposing_components: string[];
      raw_data_used?: Record<string, unknown>;
      calculation_notes?: Record<string, string>;
    };
    why: string[];
    invalidations: string[];
  };
}

const LATEST_ASSET_STATE_SELECT = [
  "asset",
  "snapshot_time_utc",
  "reference_price",
  "reference_price_date",
  "price_source",
  "overall_signal",
  "total_score",
  "action",
  "market_bias",
  "conviction",
  "position_size_bucket",
  "updated_at",
  "signal_story",
].join(",");

export interface MarketOverview {
  updated_at: string;
  fear_greed: {
    latest: Record<string, unknown>;
    previous: Record<string, unknown>;
    series: Record<string, unknown>[];
  };
  futures_open_interest: {
    latest: Record<string, unknown>;
    series: Record<string, unknown>[];
  };
  sector_spotlight: {
    sector?: { name: string; marketcap_dom: number; change_pct_24h: number }[];
    spotlight?: { name: string; change_pct_24h: number }[];
  };
  etf_metrics: Record<string, Record<string, unknown>>;
}

export interface EngineSummary {
  updated_at: string;
  assets: Record<string, {
    asset: string;
    overall_signal: ComponentState;
    total_score: number;
    action: Action;
    market_bias: MarketBias;
    conviction: Conviction;
    position_size_bucket: "small" | "medium" | "large";
    why: string[];
    invalidations: string[];
  }>;
}

// ── latest_asset_state ────────────────────────────────────────────────────────

export async function fetchLatestAssetState(): Promise<DecisionAsset[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("latest_asset_state")
      .select(LATEST_ASSET_STATE_SELECT)
      .order("updated_at", { ascending: false });

    if (error || !data) {
      if (error) console.error("[v0] latest_asset_state query error:", error.message);
      return [];
    }

    const latestByAsset = new Map<string, Record<string, unknown>>();
    for (const row of data as Record<string, unknown>[]) {
      const assetKey = String(row.asset ?? "").toUpperCase();
      if (!assetKey || latestByAsset.has(assetKey)) continue;
      latestByAsset.set(assetKey, row);
    }

    const rows = Array.from(latestByAsset.values());

    return rows.map((row) => {
      // Parse signal_story if it's a string
      let signalStory = row.signal_story;
      if (typeof signalStory === "string") {
        try { signalStory = JSON.parse(signalStory); } catch {}
      }

      return {
        asset:                (row.asset as string).toUpperCase(), // Normalize to uppercase for UI
        snapshot_time_utc:    row.snapshot_time_utc as string | undefined,
        reference_price:      row.reference_price as number | null,
        reference_price_date: row.reference_price_date as string | null,
        price_source:         row.price_source as string | null,
        overall_signal:       row.overall_signal as ComponentState,
        total_score:          row.total_score as number,
        action:               row.action as Action,
        market_bias:          row.market_bias as MarketBias,
        conviction:           row.conviction as Conviction,
        position_size_bucket: row.position_size_bucket as "small" | "medium" | "large",
        updated_at:           row.updated_at as string,
        signal_story:         signalStory,
      };
    }) as DecisionAsset[];
  } catch (err) {
    console.error("[v0] fetchLatestAssetState error:", err);
    return [];
  }
}

// ── site_cache: market_overview ───────────────────────────────────────────────

export async function fetchMarketOverview(): Promise<MarketOverview | null> {
  try {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("site_cache")
      .select("*")
      .eq("cache_key", "market_overview")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("[v0] market_overview query error:", error.message);
      return null;
    }

    // Parse payload if it's a string
    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    return payload as MarketOverview;
  } catch (err) {
    console.error("[v0] fetchMarketOverview error:", err);
    return null;
  }
}

// ── site_cache: engine_summary ────────────────────────────────────────────────

export async function fetchEngineSummary(): Promise<EngineSummary | null> {
  try {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("site_cache")
      .select("*")
      .eq("cache_key", "engine_summary")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("[v0] engine_summary query error:", error.message);
      return null;
    }

    // Parse payload if it's a string
    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    return payload as EngineSummary;
  } catch (err) {
    console.error("[v0] fetchEngineSummary error:", err);
    return null;
  }
}

// ── site_cache: news_chart_{asset} ────────────────────────────────────────────

export interface NewsItem {
  id: string;
  asset: string;
  title: string;
  original_title?: string;
  timestamp_ms: number;
  timestamp_iso: string;
  bucket_open_ms_4h: number;
  bucket_open_iso_4h: string;
  source_link: string | null;
  original_link: string | null;
  category: number;
  category_label: string;
  author: string | null;
  nick_name: string | null;
  tags: string[];
  matched_currencies: Record<string, unknown>[];
  feature_image: string | null;
  content_excerpt?: string;
  impression_count: number;
  like_count: number;
  reply_count: number;
  retweet_count: number;
  importance_score: number;
  is_major: boolean;
}

export interface MarkerGroup {
  bucket_open_ms_4h: number;
  bucket_open_iso_4h: string;
  item_count: number;
  top_title: string;
  titles: string[];
  items: NewsItem[];
}

export interface NewsCachePayload {
  updated_at: string;
  asset: string;
  currency_id: string | null;
  lookback_days: number;
  time_bucket: string;
  major_items: NewsItem[];
  recent_items: NewsItem[];
  markers_4h: MarkerGroup[];
  summary: {
    total_items: number;
    major_count: number;
    recent_count: number;
    has_news: boolean;
  };
}

export async function fetchNewsCache(asset: string): Promise<NewsCachePayload | null> {
  try {
    const cacheKey = `news_chart_${asset.toLowerCase()}`;
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("site_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("[v0] news cache query error:", error.message);
      return null;
    }

    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    return payload as NewsCachePayload;
  } catch (err) {
    console.error("[v0] fetchNewsCache error:", err);
    return null;
  }
}

export interface MarketNewsCachePayload {
  updated_at: string;
  scope: string;
  lookback_hours: number;
  time_bucket: string;
  major_items: NewsItem[];
  recent_items: NewsItem[];
  markers_4h: MarkerGroup[];
  summary: {
    total_items: number;
    major_count: number;
    recent_count: number;
    has_news: boolean;
  };
}

export async function fetchMarketNewsCache(): Promise<MarketNewsCachePayload | null> {
  try {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("site_cache")
      .select("*")
      .eq("cache_key", "news_chart_crypto")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("[v0] market news cache query error:", error.message);
      return null;
    }

    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    return payload as MarketNewsCachePayload;
  } catch (err) {
    console.error("[v0] fetchMarketNewsCache error:", err);
    return null;
  }
}



export interface QuickTradeKlineRow {
  open_time_ms: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  base_volume: number | null;
  quote_volume: number | null;
  symbol: string | null;
}

export interface QuickTradeFundingRow {
  funding_time_ms: number | null;
  funding_rate: number | null;
  mark_price: number | null;
  symbol: string | null;
}

export interface QuickTradeLongShortRow {
  timestamp_ms: number | null;
  long_short_ratio: number | null;
  long_account_share: number | null;
  short_account_share: number | null;
  symbol: string | null;
}

export interface QuickTradeOpenInterestRow {
  timestamp_ms: number | null;
  sum_open_interest: number | null;
  sum_open_interest_value: number | null;
  symbol: string | null;
}

export interface QuickTradeStrategyDefinition {
  label: string;
  purpose: string;
  primary_timeframe: string;
  confirmation_timeframe: string;
  client_rules: Record<string, number>;
}

export interface QuickTradeInputPayload {
  engine: string;
  updated_at: string;
  asset: string;
  symbol: string;
  market: string;
  sodex_symbol: string;
  server_schedule: {
    refresh_interval_minutes: number;
    client_max_data_age_minutes: number;
    client_refresh_buffer_minutes: number;
    fresh_until: string;
    next_expected_update_at: string;
    wait_for_next_refresh_until: string;
    client_rule: string;
  };
  latest_context: {
    reference_price: number | null;
    reference_price_source: string | null;
  };
  datasets: {
    klines: {
      "5m": QuickTradeKlineRow[];
      "15m": QuickTradeKlineRow[];
      "1h": QuickTradeKlineRow[];
    };
    funding_rates: QuickTradeFundingRow[];
    long_short_ratio_1h: QuickTradeLongShortRow[];
    open_interest_5m: QuickTradeOpenInterestRow[];
  };
  strategy_playbook: Record<string, QuickTradeStrategyDefinition>;
}

export async function fetchQuickTradeInputs(asset: string): Promise<QuickTradeInputPayload | null> {
  const assetKey = asset.toLowerCase();
  if (assetKey !== "btc" && assetKey !== "eth") return null;

  try {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("site_cache")
      .select("*")
      .eq("cache_key", `quick_trade_inputs_${assetKey}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      if (error) console.error("[v0] quick trade query error:", error.message);
      return null;
    }

    let payload = row.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch {}
    }

    return payload as QuickTradeInputPayload;
  } catch (err) {
    console.error("[v0] fetchQuickTradeInputs error:", err);
    return null;
  }
}

// Legacy alias for backwards compatibility
export type SiteCache = MarketOverview;
export const fetchSiteCache = fetchMarketOverview;
