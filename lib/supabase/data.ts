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
    const res = await fetch("/api/asset-state", { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    const rows: Record<string, unknown>[] = json.data ?? [];

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
    const res = await fetch("/api/site-cache?cache_key=market_overview", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json.data;
    if (!row) return null;

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
    const res = await fetch("/api/site-cache?cache_key=engine_summary", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json.data;
    if (!row) return null;

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

// Legacy alias for backwards compatibility
export type SiteCache = MarketOverview;
export const fetchSiteCache = fetchMarketOverview;
