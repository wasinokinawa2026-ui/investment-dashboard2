import { NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

interface RawArticle {
  title?: string;
  source?: { name?: string };
  url?: string;
  publishedAt?: string;
  description?: string;
}

interface ScoredArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description: string;
  pre_score: number;
}

interface LLMArticleInput {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description: string;
}

interface AnalyzedArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  relevance_score: number;
  score_reason: string;
  directional_signal: "Bullish" | "Bearish" | "Neutral" | "Mixed";
  primary_tickers: string[];
  confidence: "High" | "Medium" | "Low";
  summaryBullets: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_SYMBOLS = new Set(["NVDA", "AVGO"]);

const TRUSTED_SOURCES = [
  // 글로벌 금융/경제 1티어
  "reuters",
  "bloomberg",
  "wall street journal",
  "wsj",
  "financial times",
  "ft.com",
  "the economist",
  "barrons",
  "fortune",
  "forbes",
  "marketwatch",
  // 방송/미디어
  "cnbc",
  "bbc",
  "nikkei",
  "axios",
  // 테크 전문
  "the information",
  "techcrunch",
  "wired",
  "ars technica",
  "the verge",
  "mit technology review",
  "ieee spectrum",
  // 반도체/하드웨어 전문
  "digitimes",
  "eetimes",
  "tom's hardware",
];

const BLOCKED_SOURCES = [
  "github",
  "pypi",
  "seclists",
  "majorgeeks",
  "crypto briefing",
  "cryptobriefing",
  "alltoc",
];

const BLOCKED_KEYWORDS = [
  "spacex",
  "healthcare",
  "mac mini",
  "crypto",
  "coin",
  "etf",
  "ipo wait",
];

const HIGH_VALUE_KEYWORDS = [
  "earnings", "revenue", "margin", "guidance", "forecast",
  "capex", "data center", "datacenter", "ai chip", "semiconductor",
  "hbm", "supply", "demand", "export control", "tsmc",
];

// ── In-memory cache (30 min TTL) ──────────────────────────────────────────────

const responseCache = new Map<string, { data: AnalyzedArticle[]; expiry: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = validateSymbol(searchParams.get("symbol") ?? "NVDA");

  const newsApiKey = process.env.NEWS_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!newsApiKey || !openAiApiKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const cached = responseCache.get(symbol);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const articles = await fetchAndFilterNews(symbol, newsApiKey);

    if (articles.length === 0) {
      return NextResponse.json([]);
    }

    const result = await analyzeNewsWithLLM({ articles, symbol, openAiApiKey });

    responseCache.set(symbol, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result);
  } catch (error) {
    console.error("NEWS ROUTE ERROR:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to fetch and analyze news" }, { status: 500 });
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateSymbol(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
  return VALID_SYMBOLS.has(upper) ? upper : "NVDA";
}

// ── News fetching ─────────────────────────────────────────────────────────────

async function fetchAndFilterNews(symbol: string, apiKey: string): Promise<ScoredArticle[]> {
  const query =
    symbol === "NVDA"
      ? '(Nvidia OR NVDA) AND (AI OR GPU OR "data center" OR semiconductor OR chip OR earnings OR capex)'
      : '(Broadcom OR AVGO) AND (AI OR ASIC OR "custom chip" OR networking OR semiconductor OR earnings OR capex)';

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=50`;

  const res = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`News API responded with ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data.articles)) {
    return [];
  }

  const scored = (data.articles as RawArticle[])
    .filter((a) => isUsableArticle(a, symbol))
    .map((a) => toScoredArticle(a, symbol))
    .filter((a) => a.pre_score >= 35);

  const deduped = removeDuplicateArticles(scored);
  deduped.sort((a, b) => b.pre_score - a.pre_score);

  return deduped.slice(0, 25);
}

function toScoredArticle(a: RawArticle, symbol: string): ScoredArticle {
  return {
    title: a.title ?? "",
    source: a.source?.name ?? "Unknown",
    url: a.url ?? "",
    publishedAt: a.publishedAt ?? "",
    description: a.description ?? "",
    pre_score: scoreArticle(a, symbol),
  };
}

function isUsableArticle(article: RawArticle, symbol: string): boolean {
  const source = article.source?.name?.toLowerCase() ?? "";
  const title = article.title?.toLowerCase() ?? "";
  const description = article.description?.toLowerCase() ?? "";
  const url = article.url?.toLowerCase() ?? "";
  const text = `${title} ${description}`;

  if (!article.title || !article.url) return false;
  if (BLOCKED_SOURCES.some((s) => source.includes(s) || url.includes(s))) return false;
  if (BLOCKED_KEYWORDS.some((kw) => text.includes(kw))) return false;

  if (symbol === "NVDA") {
    return (
      text.includes("nvidia") ||
      text.includes("nvda") ||
      (text.includes("ai") &&
        (text.includes("gpu") ||
          text.includes("chip") ||
          text.includes("semiconductor") ||
          text.includes("data center") ||
          text.includes("datacenter")))
    );
  }

  return (
    text.includes("broadcom") ||
    text.includes("avgo") ||
    (text.includes("ai") &&
      (text.includes("asic") ||
        text.includes("custom chip") ||
        text.includes("custom silicon") ||
        text.includes("networking") ||
        text.includes("semiconductor")))
  );
}

function scoreArticle(article: RawArticle, symbol: string): number {
  const source = article.source?.name?.toLowerCase() ?? "";
  const title = article.title?.toLowerCase() ?? "";
  const description = article.description?.toLowerCase() ?? "";
  const text = `${title} ${description}`;

  let score = 0;

  if (TRUSTED_SOURCES.some((s) => source.includes(s))) score += 20;

  if (symbol === "NVDA") {
    if (text.includes("nvidia")) score += 35;
    if (text.includes("nvda")) score += 35;
    if (text.includes("gpu")) score += 15;
  } else {
    if (text.includes("broadcom")) score += 35;
    if (text.includes("avgo")) score += 35;
    if (text.includes("asic")) score += 20;
    if (text.includes("custom chip") || text.includes("custom silicon")) score += 20;
    if (text.includes("networking")) score += 10;
  }

  for (const kw of HIGH_VALUE_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }

  return Math.min(100, score);
}

function removeDuplicateArticles<T extends { title: string; url: string }>(articles: T[]): T[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  return articles.filter((a) => {
    const titleKey = a.title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90);
    const urlKey = a.url.split("?")[0]; // 쿼리스트링 제거 후 비교
    if (!titleKey) return false;
    if (seenTitles.has(titleKey) || seenUrls.has(urlKey)) return false;
    seenTitles.add(titleKey);
    seenUrls.add(urlKey);
    return true;
  });
}

// ── LLM analysis ──────────────────────────────────────────────────────────────

async function analyzeNewsWithLLM({
  articles,
  symbol,
  openAiApiKey,
}: {
  articles: ScoredArticle[];
  symbol: string;
  openAiApiKey: string;
}): Promise<AnalyzedArticle[]> {
  const llmInput: LLMArticleInput[] = articles.map(
    ({ title, source, url, publishedAt, description }) => ({
      title,
      source,
      url,
      publishedAt,
      description,
    })
  );

  const prompt = `
You are a senior equity research analyst specializing in AI semiconductors.

Target ticker: ${symbol}

From the candidate articles below, select the top 10 most investment-relevant articles.

Scoring rules:
- relevance_score must be 0 to 100.
- 90-100: directly material to revenue, earnings, AI demand, guidance, capex, supply chain, pricing power, or competition.
- 70-89: clearly related to AI semiconductor investment thesis.
- 50-69: moderately relevant sector news.
- below 50: weak or indirect relevance. Avoid selecting unless there are not enough articles.

For each selected article:
- Explain score_reason in Korean, one short sentence.
- Provide exactly 5 Korean investment insight bullets.
- Do not invent numbers not present in the article metadata.
- If information is weak, clearly say uncertainty is high.

Candidate articles:
${JSON.stringify(llmInput, null, 2)}
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      temperature: 0.2,
      text: {
        format: {
          type: "json_schema",
          name: "ranked_news_response",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["articles"],
            properties: {
              articles: {
                type: "array",
                minItems: 0,
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "title", "source", "url", "publishedAt",
                    "relevance_score", "score_reason", "directional_signal",
                    "primary_tickers", "confidence", "summaryBullets",
                  ],
                  properties: {
                    title: { type: "string" },
                    source: { type: "string" },
                    url: { type: "string" },
                    publishedAt: { type: "string" },
                    relevance_score: { type: "number", minimum: 0, maximum: 100 },
                    score_reason: { type: "string" },
                    directional_signal: {
                      type: "string",
                      enum: ["Bullish", "Bearish", "Neutral", "Mixed"],
                    },
                    primary_tickers: { type: "array", items: { type: "string" } },
                    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                    summaryBullets: {
                      type: "array",
                      minItems: 5,
                      maxItems: 5,
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "OpenAI API request failed");
  }

  const text: string = data.output?.[0]?.content?.[0]?.text ?? data.output_text ?? "";

  if (!text) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(text);
  return (parsed.articles ?? []) as AnalyzedArticle[];
}
