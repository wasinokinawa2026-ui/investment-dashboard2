"use client";

import { useEffect, useMemo, useState } from "react";
import StockChart from "../components/StockChart";

type StockPoint = { time: string; value: number };
type NewsItem = { title: string; source: string; url: string; publishedAt: string; summary: string };
type ArchivedNewsItem = NewsItem & { archivedAt: string };
type Ticker = "NVDA" | "AVGO";
type RangeKey = "1M" | "6M" | "1Y" | "3Y";

const rangeMap: Record<RangeKey, number> = { "1M": 22, "6M": 132, "1Y": 264, "3Y": 756 };

function filterDataByRange(data: StockPoint[], range: RangeKey) {
  return data.slice(-rangeMap[range]);
}

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<Ticker>("NVDA");
  const [selectedRange, setSelectedRange] = useState<RangeKey>("3Y");
  const [data, setData] = useState<StockPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [archivedNews, setArchivedNews] = useState<ArchivedNewsItem[]>([]);

  useEffect(() => {
    async function fetchPrices() {
      try {
        setLoading(true); setError("");
        const res = await fetch(`/api/prices?symbol=${selectedTicker}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "주가 데이터를 불러오지 못했습니다.");
        setData(json);
      } catch (err: any) { setError(err.message); setData([]); }
      finally { setLoading(false); }
    }
    fetchPrices();
  }, [selectedTicker]);

  useEffect(() => {
    async function fetchNews() {
      try {
        setNewsLoading(true); setNewsError("");
        const res = await fetch(`/api/news?symbol=${selectedTicker}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "뉴스를 불러오지 못했습니다.");
        setNews(json);
      } catch (err: any) { setNewsError(err.message); setNews([]); }
      finally { setNewsLoading(false); }
    }
    fetchNews();
  }, [selectedTicker]);

  useEffect(() => {
    const saved = localStorage.getItem("archivedNews");
    if (saved) { try { setArchivedNews(JSON.parse(saved)); } catch { setArchivedNews([]); } }
  }, []);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return filterDataByRange(data, selectedRange);
  }, [data, selectedRange]);

  function archiveNewsItem(item: NewsItem) {
    setArchivedNews((prev) => {
      if (prev.some((n) => n.url === item.url)) return prev;
      const updated = [{ ...item, archivedAt: new Date().toISOString() }, ...prev];
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

  return (
    <main style={{ minHeight: "100vh", background: "#0a0f1e", color: "#f1f5f9", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>Live Dashboard</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>My Investment Dashboard</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Nvidia · Broadcom · AI/ASIC</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Bloomberg */}
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #1e293b", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "16px 16px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📺</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Bloomberg Live</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#ef4444", fontWeight: 600, background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 20 }}>● LIVE</span>
              </div>
            </div>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src="https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6AmdCLP7Lg&autoplay=1&mute=1"
                title="Bloomberg Live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} />
            </div>
          </div>

          {/* 종목 + 기간 선택 */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 16 }}>
            <p style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>종목</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["NVDA", "AVGO"] as Ticker[]).map((t) => (
                <button key={t} onClick={() => setSelectedTicker(t)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
                  background: selectedTicker === t ? "linear-gradient(135deg, #10b981, #059669)" : "#1e293b",
                  color: selectedTicker === t ? "#000" : "#94a3b8",
                  boxShadow: selectedTicker === t ? "0 4px 15px rgba(16,185,129,0.3)" : "none",
                  transition: "all 0.2s"
                }}>{t}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>기간</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["1M", "6M", "1Y", "3Y"] as RangeKey[]).map((r) => (
                <button key={r} onClick={() => setSelectedRange(r)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                  background: selectedRange === r ? "linear-gradient(135deg, #10b981, #059669)" : "#1e293b",
                  color: selectedRange === r ? "#000" : "#94a3b8",
                  boxShadow: selectedRange === r ? "0 4px 15px rgba(16,185,129,0.3)" : "none",
                  transition: "all 0.2s"
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* 차트 */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>주가 차트</p>
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "3px 10px", borderRadius: 20 }}>{selectedTicker} · {selectedRange}</span>
            </div>
            <div style={{ borderRadius: 12, overflow: "hidden", background: "#020817" }}>
              {loading && <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 14 }}>불러오는 중...</div>}
              {!loading && error && <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 14 }}>{error}</div>}
              {!loading && !error && filteredData.length > 0 && <StockChart data={filteredData} />}
            </div>
          </div>

          {/* Important News */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 16 }}>
            <p style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Important News</p>
            {newsLoading && <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>뉴스 불러오는 중...</div>}
            {!newsLoading && newsError && <div style={{ color: "#ef4444", fontSize: 14 }}>{newsError}</div>}
            {!newsLoading && !newsError && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {news.map((n, i) => (
                  <div key={i} style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 16, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none", color: "inherit" }}>
                        <p style={{ fontSize: 11, color: "#10b981", fontWeight: 600, margin: "0 0 4px" }}>{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</p>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.4, color: "#f1f5f9" }}>{n.title}</h3>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{n.summary}</p>
                      </a>
                      <button onClick={() => archiveNewsItem(n)} disabled={isArchived(n.url)} style={{
                        flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "none", cursor: isArchived(n.url) ? "not-allowed" : "pointer",
                        fontSize: 11, fontWeight: 700,
                        background: isArchived(n.url) ? "#1e293b" : "linear-gradient(135deg, #10b981, #059669)",
                        color: isArchived(n.url) ? "#475569" : "#000"
                      }}>{isArchived(n.url) ? "✓" : "Save"}</button>
                    </div>
                  </div>
                ))}
                {news.length === 0 && <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>표시할 뉴스가 없습니다.</div>}
              </div>
            )}
          </div>

          {/* Archived News */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>Archived News</p>
              <span style={{ fontSize: 11, color: "#475569", background: "#1e293b", padding: "3px 10px", borderRadius: 20 }}>{archivedNews.length}건</span>
            </div>
            {archivedNews.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: 20 }}>저장된 뉴스가 없습니다.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {archivedNews.map((n, i) => (
                  <div key={i} style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 16, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none", color: "inherit" }}>
                        <p style={{ fontSize: 11, color: "#10b981", fontWeight: 600, margin: "0 0 4px" }}>{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</p>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.4, color: "#f1f5f9" }}>{n.title}</h3>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{n.summary}</p>
                        <p style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>저장일: {new Date(n.archivedAt).toLocaleString()}</p>
                      </a>
                      <button onClick={() => removeArchivedNews(n.url)} style={{
                        flexShrink: 0, padding: "6px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                        fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#ef4444"
                      }}>삭제</button>
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