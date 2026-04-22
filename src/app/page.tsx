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
  summary: string;
};

type ArchivedNewsItem = NewsItem & {
  archivedAt: string;
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
  const count = rangeMap[range];
  return data.slice(-count);
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
        setLoading(true);
        setError("");
        const res = await fetch(`/api/prices?symbol=${selectedTicker}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "주가 데이터를 불러오지 못했습니다.");
        setData(json);
      } catch (err: any) {
        setError(err.message || "에러가 발생했습니다.");
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPrices();
  }, [selectedTicker]);

  useEffect(() => {
    async function fetchNews() {
      try {
        setNewsLoading(true);
        setNewsError("");
        const res = await fetch(`/api/news?symbol=${selectedTicker}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "뉴스를 불러오지 못했습니다.");
        setNews(json);
      } catch (err: any) {
        setNewsError(err.message || "뉴스 에러가 발생했습니다.");
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    }
    fetchNews();
  }, [selectedTicker]);

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

  function archiveNewsItem(item: NewsItem) {
    setArchivedNews((prev) => {
      const exists = prev.some((n) => n.url === item.url);
      if (exists) return prev;
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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-10">

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">My Investment Dashboard</h1>
          <p className="mt-3 text-slate-300">
            Nvidia, Broadcom 주가와 AI/ASIC 관련 뉴스를 한눈에 보는 개인용 대시보드
          </p>
        </header>

        <div className="flex gap-6 items-start">

          {/* 왼쪽: Bloomberg 라이브 */}
          <div className="w-[400px] shrink-0 sticky top-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold">📺 Bloomberg Live</h2>
              <div className="aspect-video w-full overflow-hidden rounded-xl">
                <iframe
                  src="https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6AmdCLP7Lg&autoplay=1&mute=1"
                  title="Bloomberg Business News Live"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full" />
              </div>
              <p className="mt-3 text-xs text-slate-500">Bloomberg Business News · Live Stream</p>
            </div>
          </div>

          {/* 오른쪽: 차트 + 뉴스 */}
          <div className="flex-1 min-w-0 space-y-6">

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold">종목 선택</h2>
              <div className="flex gap-3">
                <button onClick={() => setSelectedTicker("NVDA")} className={`rounded-xl px-4 py-2 font-medium ${selectedTicker === "NVDA" ? "bg-emerald-500 text-black" : "bg-slate-800 text-white"}`}>
                  NVDA
                </button>
                <button onClick={() => setSelectedTicker("AVGO")} className={`rounded-xl px-4 py-2 font-medium ${selectedTicker === "AVGO" ? "bg-emerald-500 text-black" : "bg-slate-800 text-white"}`}>
                  AVGO
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold">기간 선택</h2>
              <div className="flex flex-wrap gap-3">
                {(["1M", "6M", "1Y", "3Y"] as RangeKey[]).map((range) => (
                  <button key={range} onClick={() => setSelectedRange(range)} className={`rounded-xl px-4 py-2 font-medium ${selectedRange === range ? "bg-emerald-500 text-black" : "bg-slate-800 text-white"}`}>
                    {range}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">주가 차트</h2>
                <div className="text-sm text-slate-400">
                  현재 선택: <span className="font-semibold text-white">{selectedTicker}</span> · <span className="font-semibold text-white">{selectedRange}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                {loading && (
                  <div className="flex h-[400px] items-center justify-center text-slate-400">
                    주가 데이터를 불러오는 중...
                  </div>
                )}
                {!loading && error && (
                  <div className="flex h-[400px] items-center justify-center text-red-400">
                    {error}
                  </div>
                )}
                {!loading && !error && filteredData.length > 0 && (
                  <StockChart data={filteredData} />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold">Important News</h2>
              {newsLoading && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-400">뉴스를 불러오는 중...</div>
              )}
              {!newsLoading && newsError && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-red-400">{newsError}</div>
              )}
              {!newsLoading && !newsError && (
                <div className="space-y-4">
                  {news.map((n, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="block flex-1 hover:text-emerald-300">
                          <p className="text-sm text-emerald-400">{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</p>
                          <h3 className="mt-1 text-lg font-semibold">{n.title}</h3>
                          <p className="mt-2 text-sm text-slate-300">{n.summary}</p>
                        </a>
                        <button onClick={() => archiveNewsItem(n)} disabled={isArchived(n.url)} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${isArchived(n.url) ? "cursor-not-allowed bg-slate-700 text-slate-400" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}>
                          {isArchived(n.url) ? "Archived" : "Archive"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-400">표시할 뉴스가 없습니다.</div>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Archived News</h2>
                <span className="text-sm text-slate-400">총 {archivedNews.length}건</span>
              </div>
              {archivedNews.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-400">아직 저장된 뉴스가 없습니다.</div>
              ) : (
                <div className="space-y-4">
                  {archivedNews.map((n, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="block flex-1 hover:text-emerald-300">
                          <p className="text-sm text-emerald-400">{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</p>
                          <h3 className="mt-1 text-lg font-semibold">{n.title}</h3>
                          <p className="mt-2 text-sm text-slate-300">{n.summary}</p>
                          <p className="mt-2 text-xs text-slate-500">저장일: {new Date(n.archivedAt).toLocaleString()}</p>
                        </a>
                        <button onClick={() => removeArchivedNews(n.url)} className="shrink-0 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}