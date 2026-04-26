import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildSignalApiPayload } from "@/lib/signal-api";
import type { DecisionAsset } from "@/lib/supabase/data";

const SIGNAL_API_SELECT = [
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

function normalizeRow(row: Record<string, unknown>): DecisionAsset {
  let signalStory = row.signal_story;
  if (typeof signalStory === "string") {
    try {
      signalStory = JSON.parse(signalStory);
    } catch {}
  }

  return {
    asset: String(row.asset ?? "").toUpperCase(),
    snapshot_time_utc: row.snapshot_time_utc as string | undefined,
    reference_price: row.reference_price as number | null,
    reference_price_date: row.reference_price_date as string | null,
    price_source: row.price_source as string | null,
    overall_signal: row.overall_signal as DecisionAsset["overall_signal"],
    total_score: row.total_score as number,
    action: row.action as DecisionAsset["action"],
    market_bias: row.market_bias as DecisionAsset["market_bias"],
    conviction: row.conviction as DecisionAsset["conviction"],
    position_size_bucket: row.position_size_bucket as DecisionAsset["position_size_bucket"],
    updated_at: row.updated_at as string,
    signal_story: signalStory as DecisionAsset["signal_story"],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetParam = searchParams.get("asset");
  const asset = assetParam ? assetParam.trim().toLowerCase() : "";
  if (!asset) {
    return NextResponse.json({ error: "Missing required query parameter: asset" }, { status: 400 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const query = supabase
    .from("latest_asset_state")
    .select(SIGNAL_API_SELECT)
    .eq("asset", asset)
    .order("updated_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const latestRow = rows[0];
  if (!latestRow) {
    return NextResponse.json({ error: `No signal found for asset: ${asset.toUpperCase()}` }, { status: 404 });
  }

  const payload = buildSignalApiPayload(normalizeRow(latestRow));

  return NextResponse.json(
    {
      version: "v1",
      generated_at: new Date(payload.updated_at).getTime(),
      signal: payload,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
