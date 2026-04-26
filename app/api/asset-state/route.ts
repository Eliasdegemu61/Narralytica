import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
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

  const latestAssetStateSelect = [
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

  const { data, error } = await supabase
    .from("latest_asset_state")
    .select(latestAssetStateSelect)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
