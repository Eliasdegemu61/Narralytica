import type { DecisionAsset } from "@/lib/supabase/data";

export interface SignalApiPayload {
  asset: string;
  action: DecisionAsset["action"];
  market_bias: DecisionAsset["market_bias"];
  conviction: DecisionAsset["conviction"];
  position_size_bucket: DecisionAsset["position_size_bucket"];
  overall_signal: DecisionAsset["overall_signal"];
  total_score: number;
  reference_price: number | null;
  reference_price_date: string | null;
  price_source: string | null;
  snapshot_time_utc: string | null;
  updated_at: string;
  invalidations: string[];
}

export function buildSignalApiPayload(data: DecisionAsset): SignalApiPayload {
  return {
    asset: data.asset,
    action: data.action,
    market_bias: data.market_bias,
    conviction: data.conviction,
    position_size_bucket: data.position_size_bucket,
    overall_signal: data.overall_signal,
    total_score: data.total_score,
    reference_price: data.reference_price,
    reference_price_date: data.reference_price_date,
    price_source: data.price_source ?? null,
    snapshot_time_utc: data.snapshot_time_utc ?? null,
    updated_at: data.updated_at,
    invalidations: data.signal_story.invalidations,
  };
}
