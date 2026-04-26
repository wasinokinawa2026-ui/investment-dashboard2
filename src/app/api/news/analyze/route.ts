import { NextResponse } from "next/server";

interface AnalyzeRequest {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  score_reason: string;
  summaryBullets: string[];
  symbol: string;
}

interface DeepAnalysis {
  keyPoints: string[];
  investmentImplications: string[];
  marketContext: string[];
  risks: string[];
  watchFor: string[];
}

export async function POST(req: Request) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.title || !body?.symbol) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await deepAnalyze(body, openAiApiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ANALYZE ERROR:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

async function deepAnalyze(article: AnalyzeRequest, apiKey: string): Promise<DeepAnalysis> {
  const prompt = `
You are a senior equity research analyst specializing in AI semiconductors (${article.symbol}).

An investor clicked "더 깊게 분석하기" on the following article. Provide a comprehensive deep-dive analysis in Korean.

Article:
- Title: ${article.title}
- Source: ${article.source}
- Published: ${article.publishedAt}
- Initial assessment: ${article.score_reason}
- Key bullets already shown: ${article.summaryBullets.join(" | ")}

Using your expertise in AI semiconductors, ${article.symbol}'s business model, competitive landscape, supply chain, and current macro environment, provide:

1. keyPoints (5): Key factual and contextual points — go beyond the article, add industry context the investor needs to know
2. investmentImplications (5): Direct implications for ${article.symbol} shareholders — revenue, margins, demand, competitive positioning
3. marketContext (4): Broader AI semiconductor market dynamics relevant to this news — include competitors, customers, macro trends
4. risks (4): Specific risk factors this news highlights or amplifies for ${article.symbol}
5. watchFor (4): Concrete upcoming metrics, events, earnings dates, or catalysts related to this story

All responses must be in Korean. Be specific — avoid vague statements. Reference real companies, figures, or industry dynamics where relevant.
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      input: prompt,
      temperature: 0.3,
      text: {
        format: {
          type: "json_schema",
          name: "deep_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "keyPoints",
              "investmentImplications",
              "marketContext",
              "risks",
              "watchFor",
            ],
            properties: {
              keyPoints: {
                type: "array",
                minItems: 5,
                maxItems: 5,
                items: { type: "string" },
              },
              investmentImplications: {
                type: "array",
                minItems: 5,
                maxItems: 5,
                items: { type: "string" },
              },
              marketContext: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
              },
              risks: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
              },
              watchFor: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
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

  return JSON.parse(text) as DeepAnalysis;
}
