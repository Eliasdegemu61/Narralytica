import { NextResponse } from "next/server";

const HOT_NEWS_URL = "https://api.sosovalue.xyz/openapi/v1/news/hot";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(7, Number(searchParams.get("days") ?? "7")));
  const pageNum = Math.max(1, Number(searchParams.get("page_num") ?? "1"));
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("page_size") ?? "100")));
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const upstreamUrl = new URL(HOT_NEWS_URL);
  upstreamUrl.searchParams.set("start_time", String(startTime));
  upstreamUrl.searchParams.set("end_time", String(endTime));
  upstreamUrl.searchParams.set("pageNum", String(pageNum));
  upstreamUrl.searchParams.set("pageSize", String(pageSize));

  try {
    const response = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const raw = await response.text();
    let payload: unknown = null;

    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Upstream hot news request failed with ${response.status}`;

      return NextResponse.json(
        {
          error: message,
          status: response.status,
          upstream: payload,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown hot news fetch error",
      },
      { status: 500 },
    );
  }
}
