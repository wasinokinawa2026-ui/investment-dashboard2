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
  analysis: string;
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
You are a senior equity research analyst at a top-tier investment bank covering AI semiconductors.

An investor is reading the following article and wants deep market intelligence — not a summary, but a cohesive investment research memo triggered by the article's themes and keywords.

Article (starting point only):
- Title: ${article.title}
- Source: ${article.source}
- Published: ${article.publishedAt}
- Initial bullets: ${article.summaryBullets.join(" | ")}

Target: ${article.symbol}

Write a flowing analytical memo in Korean (~500 words). Natural paragraphs, no headers, no bullet points, no numbered lists.

RULES:
- Do NOT restate what the article says — add new information and context the investor doesn't have yet
- Use the article's keywords as triggers to discuss broader industry dynamics
- Reference real companies (TSMC, SK Hynix, Micron, AMD, Intel, Marvell, Google, Microsoft, Meta, Amazon, ASML), real product names, real figures, and concrete timelines
- Cover: industry context, how it affects ${article.symbol}'s business, competitive dynamics, risks, and what to watch — but as one continuous analytical narrative, not separate sections
- Write like a thoughtful analyst memo: direct, specific, no vague platitudes
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
            required: ["analysis"],
            properties: {
              analysis: { type: "string" },
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
