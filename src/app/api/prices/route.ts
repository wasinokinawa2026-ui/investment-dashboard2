import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "NVDA";

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing TWELVE_DATA_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=750&format=JSON&apikey=${apiKey}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (!data.values || !Array.isArray(data.values)) {
    return NextResponse.json(
      { error: "No price data returned", details: data },
      { status: 500 }
    );
  }

  const formatted = data.values
    .map((item: { datetime: string; close: string }) => ({
      time: item.datetime.slice(0, 10),
      value: parseFloat(item.close),
    }))
    .reverse();

  return NextResponse.json(formatted);
}