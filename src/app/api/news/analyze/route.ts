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
You are a senior equity research analyst at a top-tier investment bank covering AI semiconductors.

An investor is reading the following article and wants deep market intelligence — NOT a summary of the article, but investment research triggered by its themes and keywords.

Article (use as a starting point only):
- Title: ${article.title}
- Source: ${article.source}
- Published: ${article.publishedAt}
- Initial bullets: ${article.summaryBullets.join(" | ")}

Target: ${article.symbol}

CRITICAL RULES:
- Extract the key THEMES and KEYWORDS from the article, then research those themes deeply
- Do NOT restate what the article already says — add new information the investor doesn't have yet
- Draw on your knowledge of the full AI semiconductor ecosystem: TSMC, ASML, HBM suppliers (SK Hynix, Micron, Samsung), hyperscaler capex (Google, Microsoft, Meta, Amazon), competing chipmakers (AMD, Intel, Qualcomm, Marvell, custom ASICs), export controls, and macro trends
- Every bullet must be concrete, specific, and actionable — no vague generalities
- Reference real companies, real figures, real product names, real timelines wherever possible

Sections (all in Korean):
1. keyPoints (5): What a sophisticated investor must know about the THEMES in this article — historical context, structural industry dynamics, data points, and current state that go well beyond what was written
2. investmentImplications (5): How these themes concretely affect ${article.symbol}'s revenue, margins, TAM, competitive moat, or growth trajectory — be specific about which business segment and why
3. marketContext (4): Structural and competitive forces in AI semiconductors relevant to these themes — what competitors, hyperscalers, foundries, and policymakers are doing right now
4. risks (4): Key risks these themes expose for ${article.symbol} — regulatory, competitive displacement, demand cyclicality, supply chain concentration, geopolitical
5. watchFor (4): Specific upcoming events, earnings calls (with approximate dates), product launch windows, policy deadlines, or macro data releases that will determine how these themes play out
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
