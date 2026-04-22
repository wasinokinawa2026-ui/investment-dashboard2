import { NextResponse } from "next/server";

const TRUSTED_SOURCES = [
  "reuters",
  "bloomberg",
  "cnbc",
  "wall street journal",
  "the wall street journal",
  "wsj",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "NVDA";

  const apiKey = process.env.NEWS_API_KEY;

  console.log("NEWS_API_KEY exists:", !!apiKey);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing NEWS_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const query =
    symbol === "NVDA"
      ? "(Nvidia OR NVDA)"
      : "(Broadcom OR AVGO)";

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    query
  )}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    console.log("News API status:", res.status);
    console.log("News API response:", data);

    if (!res.ok) {
      return NextResponse.json(
        { error: "News API request failed", details: data },
        { status: 500 }
      );
    }

    if (!data.articles || !Array.isArray(data.articles)) {
      return NextResponse.json(
        { error: "No news data", details: data },
        { status: 500 }
      );
    }

    console.log(
      "Article sources:",
      data.articles.map((a: any) => a?.source?.name)
    );

    let filtered = data.articles.filter((a: any) => {
      const sourceName = a?.source?.name?.toLowerCase?.() || "";
      return TRUSTED_SOURCES.some((s) => sourceName.includes(s));
    });

    console.log("Total articles:", data.articles.length);
    console.log("Filtered articles:", filtered.length);

    if (filtered.length === 0) {
      filtered = data.articles;
    }

    const result = filtered.slice(0, 10).map((a: any) => ({
      title: a.title,
      source: a.source?.name || "Unknown",
      url: a.url,
      publishedAt: a.publishedAt,
      summary: generateInsight(a.title, a.description),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("NEWS ROUTE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch news", details: String(error) },
      { status: 500 }
    );
  }
}

function generateInsight(title: string, description?: string) {
  const text = `${title} ${description || ""}`.toLowerCase();

  if (text.includes("ai") || text.includes("datacenter")) {
    return "AI 수요 증가 → 데이터센터 투자 확대 → 반도체 수요 긍정";
  }

  if (text.includes("asic") || text.includes("custom chip")) {
    return "ASIC 확대 → Broadcom 수혜 가능성";
  }

  if (text.includes("gpu")) {
    return "GPU 수요 증가 → Nvidia 실적 상승 가능성";
  }

  return "반도체 산업 전반 영향 가능";
}