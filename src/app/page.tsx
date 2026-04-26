"use client";

import { useEffect, useMemo, useState } from "react";
import StockChart from "../components/StockChart";

type StockPoint = {
  time: string;
  value: number;
};

type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  relevance_score?: number;
total_score?: number;
score?: number;
  score_reason: string;
  directional_signal: "Bullish" | "Bearish" | "Neutral" | "Mixed";
  primary_tickers: string[];
  confidence: "High" | "Medium" | "Low";
  summaryBullets: string[];
};

type ArchivedNewsItem = NewsItem & {
  archivedAt: string;
};

type DeepAnalysis = {
  analysis: string;
};

type Ticker = "NVDA" | "AVGO";
type RangeKey = "1M" | "6M" | "1Y" | "3Y";

const rangeMap: Record<RangeKey, number> = {
  "1M": 22,
  "6M": 132,
  "1Y": 264,
  "3Y": 756,
};

function filterDataByRange(data: StockPoint[], range: RangeKey) {
  return data.slice(-rangeMap[range]);
}

function signalColor(signal: NewsItem["directional_signal"]) {
  if (signal === "Bullish") return "#10b981";
  if (signal === "Bearish") return "#ef4444";
  if (signal === "Mixed") return "#f59e0b";
  return "#94a3b8";
}

function scoreColor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#84cc16";
  if (score >= 50) return "#f59e0b";
  return "#64748b";
}

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<Ticker>("NVDA");
  const [selectedRange, setSelectedRange] = useState<RangeKey>("3Y");

  const [data, setData] = useState<StockPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newsCache, setNewsCache] = useState<Partial<Record<Ticker, NewsItem[]>>>({});
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  const [archivedNews, setArchivedNews] = useState<ArchivedNewsItem[]>([]);
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null);
  const [analysisMap, setAnalysisMap] = useState<Record<string, DeepAnalysis>>({});
  const [collapsedAnalyses, setCollapsedAnalyses] = useState<Set<string>>(new Set());

  function toggleAnalysis(url: string) {
    setCollapsedAnalyses((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  useEffect(() => {
    async function fetchPrices() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/prices?symbol=${selectedTicker}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "주가 데이터를 불러오지 못했습니다.");
        }

        setData(json);
      } catch (err: any) {
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPrices();
  }, [selectedTicker]);

  useEffect(() => {
    if (newsCache[selectedTicker]) return;

    async function fetchNews() {
      try {
        setNewsLoading(true);
        setNewsError("");

        const res = await fetch(`/api/news?symbol=${selectedTicker}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "뉴스를 불러오지 못했습니다.");
        }

        setNewsCache((prev) => ({ ...prev, [selectedTicker]: json }));
      } catch (err: any) {
        setNewsError(err.message);
      } finally {
        setNewsLoading(false);
      }
    }

    fetchNews();
  }, [selectedTicker]);

  const news = newsCache[selectedTicker] ?? [];

  useEffect(() => {
    const saved = localStorage.getItem("archivedNews");

    if (saved) {
      try {
        setArchivedNews(JSON.parse(saved));
      } catch {
        setArchivedNews([]);
      }
    }
  }, []);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return filterDataByRange(data, selectedRange);
  }, [data, selectedRange]);

  const visibleNews = news.filter((n) => !isArchived(n.url));

  function archiveNewsItem(item: NewsItem) {
    setArchivedNews((prev) => {
      if (prev.some((n) => n.url === item.url)) return prev;

      const updated = [
        {
          ...item,
          archivedAt: new Date().toISOString(),
        },
        ...prev,
      ];

      localStorage.setItem("archivedNews", JSON.stringify(updated));
      return updated;
    });
  }

  function removeArchivedNews(url: string) {
    setArchivedNews((prev) => {
      const updated = prev.filter((n) => n.url !== url);
      localStorage.setItem("archivedNews", JSON.stringify(updated));
      return updated;
    });
  }

  function isArchived(url: string) {
    return archivedNews.some((n) => n.url === url);
  }

  async function analyzeArticle(article: NewsItem, symbol?: string) {
    if (analysisMap[article.url] || analyzingUrl === article.url) return;
    setAnalyzingUrl(article.url);
    try {
      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          source: article.source,
          url: article.url,
          publishedAt: article.publishedAt,
          score_reason: article.score_reason,
          summaryBullets: article.summaryBullets,
          symbol: symbol ?? selectedTicker,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalysisMap((prev) => ({ ...prev, [article.url]: data }));
      }
    } catch {
      // silent — user can retry
    } finally {
      setAnalyzingUrl(null);
    }
  }

  function renderScore(score: number) {
    const safeScore = Math.max(0, Math.min(100, Number(score || 0)));

    return (
      <div style={{ margin: "8px 0 10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 5,
          }}
        >
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            Relevance Score
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: scoreColor(safeScore),
            }}
          >
            {safeScore}/100
          </span>
        </div>

        <div
          style={{
            width: "100%",
            height: 8,
            borderRadius: 999,
            background: "#1e293b",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${safeScore}%`,
              height: "100%",
              borderRadius: 999,
              background: scoreColor(safeScore),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        color: "#f1f5f9",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#10b981",
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Live Dashboard
            </span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            My Investment Dashboard
          </h1>

          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Nvidia · Broadcom · AI/ASIC
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              border: "1px solid #1e293b",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 16px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📺</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Bloomberg Live</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: "#ef4444",
                    fontWeight: 600,
                    background: "rgba(239,68,68,0.1)",
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  ● LIVE
                </span>
              </div>
            </div>

            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src="https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6AmdCLP7Lg&autoplay=1&mute=1"
                title="Bloomberg Live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#475569",
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              종목
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["NVDA", "AVGO"] as Ticker[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    background:
                      selectedTicker === t
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : "#1e293b",
                    color: selectedTicker === t ? "#000" : "#94a3b8",
                    boxShadow:
                      selectedTicker === t
                        ? "0 4px 15px rgba(16,185,129,0.3)"
                        : "none",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <p
              style={{
                fontSize: 11,
                color: "#475569",
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              기간
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              {(["1M", "6M", "1Y", "3Y"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    background:
                      selectedRange === r
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : "#1e293b",
                    color: selectedRange === r ? "#000" : "#94a3b8",
                    boxShadow:
                      selectedRange === r
                        ? "0 4px 15px rgba(16,185,129,0.3)"
                        : "none",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                주가 차트
              </p>

              <span
                style={{
                  fontSize: 12,
                  color: "#10b981",
                  fontWeight: 700,
                  background: "rgba(16,185,129,0.1)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {selectedTicker} · {selectedRange}
              </span>
            </div>

            <div style={{ borderRadius: 12, overflow: "hidden", background: "#020817" }}>
              {loading && (
                <div
                  style={{
                    height: 280,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#475569",
                    fontSize: 14,
                  }}
                >
                  불러오는 중...
                </div>
              )}

              {!loading && error && (
                <div
                  style={{
                    height: 280,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ef4444",
                    fontSize: 14,
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && filteredData.length > 0 && <StockChart data={filteredData} />}
            </div>
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Important News · LLM Ranked Top 10
              </p>

              <span
                style={{
                  fontSize: 11,
                  color: "#10b981",
                  background: "rgba(16,185,129,0.1)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {selectedTicker}
              </span>
            </div>

            {newsLoading && (
              <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>
                LLM이 뉴스 관련성을 0~100점으로 평가하는 중입니다...
              </div>
            )}

            {!newsLoading && newsError && (
              <div style={{ color: "#ef4444", fontSize: 14 }}>{newsError}</div>
            )}

            {!newsLoading && !newsError && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleNews.map((n, i) => (
                  <div
                    key={`${i}-${n.url}`}
                    style={{
                      background: "#0a0f1e",
                      border: "1px solid #1e293b",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#10b981",
                            fontWeight: 600,
                            margin: "0 0 4px",
                          }}
                        >
                          #{i + 1} · {n.source} ·{" "}
                          {n.publishedAt
                            ? new Date(n.publishedAt).toLocaleDateString()
                            : "No date"}
                        </p>

                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <h3
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              margin: "0 0 8px",
                              lineHeight: 1.4,
                              color: "#f1f5f9",
                            }}
                          >
                            {n.title}
                          </h3>
                        </a>

                        {renderScore(n.relevance_score ?? n.total_score ?? n.score ?? 0)}

                        {n.score_reason && (
                          <p
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              margin: "0 0 10px",
                              lineHeight: 1.5,
                            }}
                          >
                            {n.score_reason}
                          </p>
                        )}

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.06)",
                              color: signalColor(n.directional_signal),
                              fontWeight: 700,
                            }}
                          >
                            {n.directional_signal}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.06)",
                              color: "#94a3b8",
                            }}
                          >
                            Confidence: {n.confidence}
                          </span>

                          {n.primary_tickers?.map((ticker) => (
                            <span
                              key={ticker}
                              style={{
                                fontSize: 11,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "rgba(16,185,129,0.12)",
                                color: "#10b981",
                              }}
                            >
                              {ticker}
                            </span>
                          ))}
                        </div>

                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#cbd5e1",
                            fontSize: 12,
                            lineHeight: 1.7,
                          }}
                        >
                          {n.summaryBullets?.map((bullet, idx) => (
                            <li key={idx}>{bullet}</li>
                          ))}
                        </ul>

                        <div style={{ marginTop: 12 }}>
                          {!analysisMap[n.url] && (
                            <button
                              onClick={() => analyzeArticle(n)}
                              disabled={analyzingUrl === n.url}
                              style={{
                                width: "100%",
                                padding: "9px 0",
                                borderRadius: 10,
                                border: "1px solid #1e3a5f",
                                cursor: analyzingUrl === n.url ? "not-allowed" : "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                background: analyzingUrl === n.url
                                  ? "transparent"
                                  : "rgba(56,189,248,0.06)",
                                color: analyzingUrl === n.url ? "#334155" : "#38bdf8",
                                letterSpacing: 0.3,
                              }}
                            >
                              {analyzingUrl === n.url ? "GPT-4o 분석 중..." : "🔍 더 깊게 분석하기"}
                            </button>
                          )}

                          {analysisMap[n.url] && !collapsedAnalyses.has(n.url) && (
                            <div style={{ marginTop: 4, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{
                                  fontSize: 10,
                                  color: "#38bdf8",
                                  fontWeight: 700,
                                  letterSpacing: 1.5,
                                  textTransform: "uppercase",
                                  margin: 0,
                                }}>
                                  심층 분석 · GPT-4o
                                </p>
                                <button
                                  onClick={() => toggleAnalysis(n.url)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#475569",
                                    fontSize: 18,
                                    lineHeight: 1,
                                    padding: "0 2px",
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              {analysisMap[n.url].analysis.split("\n\n").map((para, idx) => (
                                <p key={idx} style={{
                                  fontSize: 13,
                                  color: "#cbd5e1",
                                  lineHeight: 1.85,
                                  margin: "0 0 12px",
                                }}>
                                  {para}
                                </p>
                              ))}
                            </div>
                          )}

                          {analysisMap[n.url] && collapsedAnalyses.has(n.url) && (
                            <button
                              onClick={() => toggleAnalysis(n.url)}
                              style={{
                                width: "100%",
                                padding: "9px 0",
                                borderRadius: 10,
                                border: "1px solid #1e3a5f",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                background: "rgba(56,189,248,0.06)",
                                color: "#38bdf8",
                                letterSpacing: 0.3,
                              }}
                            >
                              📊 분석 결과 보기
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => archiveNewsItem(n)}
                        disabled={isArchived(n.url)}
                        style={{
                          flexShrink: 0,
                          padding: "6px 12px",
                          borderRadius: 10,
                          border: "none",
                          cursor: isArchived(n.url) ? "not-allowed" : "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          background: isArchived(n.url)
                            ? "#1e293b"
                            : "linear-gradient(135deg, #10b981, #059669)",
                          color: isArchived(n.url) ? "#475569" : "#000",
                        }}
                      >
                        {isArchived(n.url) ? "✓" : "Save"}
                      </button>
                    </div>
                  </div>
                ))}

                {visibleNews.length === 0 && (
                  <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>
                    표시할 뉴스가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "#475569",
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Archived News
              </p>

              <span
                style={{
                  fontSize: 11,
                  color: "#475569",
                  background: "#1e293b",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {archivedNews.length}건
              </span>
            </div>

            {archivedNews.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>
                저장된 뉴스가 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {archivedNews.map((n, i) => (
                  <div
                    key={`${i}-${n.url}`}
                    style={{
                      background: "#0a0f1e",
                      border: "1px solid #1e293b",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <p
                            style={{
                              fontSize: 11,
                              color: "#10b981",
                              fontWeight: 600,
                              margin: "0 0 4px",
                            }}
                          >
                            {n.source} ·{" "}
                            {n.publishedAt
                              ? new Date(n.publishedAt).toLocaleDateString()
                              : "No date"}
                          </p>

                          <h3
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              margin: "0 0 8px",
                              lineHeight: 1.4,
                              color: "#f1f5f9",
                            }}
                          >
                            {n.title}
                          </h3>
                        </a>

                        {renderScore(n.relevance_score ?? 0)}

                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#cbd5e1",
                            fontSize: 12,
                            lineHeight: 1.6,
                          }}
                        >
                          {n.summaryBullets?.map((bullet, idx) => (
                            <li key={idx}>{bullet}</li>
                          ))}
                        </ul>

                        <p style={{ fontSize: 11, color: "#334155", marginTop: 8 }}>
                          저장일: {new Date(n.archivedAt).toLocaleString()}
                        </p>

                        <div style={{ marginTop: 12 }}>
                          {!analysisMap[n.url] && (
                            <button
                              onClick={() => analyzeArticle(n, n.primary_tickers?.[0] ?? "NVDA")}
                              disabled={analyzingUrl === n.url}
                              style={{
                                width: "100%",
                                padding: "9px 0",
                                borderRadius: 10,
                                border: "1px solid #1e3a5f",
                                cursor: analyzingUrl === n.url ? "not-allowed" : "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                background: analyzingUrl === n.url
                                  ? "transparent"
                                  : "rgba(56,189,248,0.06)",
                                color: analyzingUrl === n.url ? "#334155" : "#38bdf8",
                                letterSpacing: 0.3,
                              }}
                            >
                              {analyzingUrl === n.url ? "GPT-4o 분석 중..." : "🔍 더 깊게 분석하기"}
                            </button>
                          )}

                          {analysisMap[n.url] && !collapsedAnalyses.has(n.url) && (
                            <div style={{ marginTop: 4, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{
                                  fontSize: 10,
                                  color: "#38bdf8",
                                  fontWeight: 700,
                                  letterSpacing: 1.5,
                                  textTransform: "uppercase",
                                  margin: 0,
                                }}>
                                  심층 분석 · GPT-4o
                                </p>
                                <button
                                  onClick={() => toggleAnalysis(n.url)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#475569",
                                    fontSize: 18,
                                    lineHeight: 1,
                                    padding: "0 2px",
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              {analysisMap[n.url].analysis.split("\n\n").map((para, idx) => (
                                <p key={idx} style={{
                                  fontSize: 13,
                                  color: "#cbd5e1",
                                  lineHeight: 1.85,
                                  margin: "0 0 12px",
                                }}>
                                  {para}
                                </p>
                              ))}
                            </div>
                          )}

                          {analysisMap[n.url] && collapsedAnalyses.has(n.url) && (
                            <button
                              onClick={() => toggleAnalysis(n.url)}
                              style={{
                                width: "100%",
                                padding: "9px 0",
                                borderRadius: 10,
                                border: "1px solid #1e3a5f",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                                background: "rgba(56,189,248,0.06)",
                                color: "#38bdf8",
                                letterSpacing: 0.3,
                              }}
                            >
                              📊 분석 결과 보기
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => removeArchivedNews(n.url)}
                        style={{
                          flexShrink: 0,
                          padding: "6px 12px",
                          borderRadius: 10,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          background: "rgba(239,68,68,0.15)",
                          color: "#ef4444",
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}