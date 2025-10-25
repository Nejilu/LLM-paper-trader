import { LRUCache } from "lru-cache";
import yahooFinance from "yahoo-finance2";
import { HistoryCandle, QuoteResponse } from "./types";

const quoteCache = new LRUCache<string, QuoteResponse>({
  max: 200,
  ttl: 1000 * 60 * 5,
  updateAgeOnGet: true
});

const historyCache = new LRUCache<string, HistoryCandle[]>({
  max: 200,
  ttl: 1000 * 60 * 15,
  updateAgeOnGet: true
});

export async function getQuote(symbol: string): Promise<QuoteResponse> {
  const normalized = symbol.trim();
  const cached = quoteCache.get(normalized);
  if (cached) {
    return cached;
  }

  try {
    const quote = await yahooFinance.quote(normalized);
    const payload: QuoteResponse = {
      symbol: quote.symbol ?? normalized,
      price:
        typeof quote.regularMarketPrice === "number"
          ? quote.regularMarketPrice
          : null,
      currency: quote.currency,
      changePercent: typeof quote.regularMarketChangePercent === "number" ? quote.regularMarketChangePercent : null,
      change: typeof quote.regularMarketChange === "number" ? quote.regularMarketChange : null,
      marketState: quote.marketState,
      previousClose:
        typeof quote.regularMarketPreviousClose === "number"
          ? quote.regularMarketPreviousClose
          : null,
      timestamp:
        typeof quote.regularMarketTime === "number"
          ? quote.regularMarketTime
          : quote.regularMarketTime instanceof Date
            ? quote.regularMarketTime.getTime()
            : null
    };

    quoteCache.set(normalized, payload);
    return payload;
  } catch (error) {
    console.error("Yahoo Finance quote failed", error);
    throw error;
  }
}

function normalizeRange(range: string) {
  switch (range.toLowerCase()) {
    case "1m":
    case "1mo":
      return "1mo";
    case "3m":
    case "3mo":
      return "3mo";
    case "6m":
    case "6mo":
      return "6mo";
    case "1y":
      return "1y";
    case "2y":
      return "2y";
    case "5y":
      return "5y";
    case "max":
      return "max";
    default:
      return range;
  }
}

const CHART_INTERVALS = [
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
  "1d",
  "5d",
  "1wk",
  "1mo",
  "3mo"
] as const;

type ChartInterval = (typeof CHART_INTERVALS)[number];

function normalizeInterval(interval: string): ChartInterval {
  const lower = interval.toLowerCase();
  if ((CHART_INTERVALS as readonly string[]).includes(lower)) {
    return lower as ChartInterval;
  }
  return "1d";
}

type ChartQuote = {
  date?: Date | null;
  timestamp?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

type ChartResponseLike = { quotes?: ChartQuote[] };

export async function getHistory(symbol: string, range: string, interval: string): Promise<HistoryCandle[]> {
  const normalizedRange = normalizeRange(range);
  const normalizedInterval = normalizeInterval(interval);
  const key = `${symbol}|${normalizedRange}|${normalizedInterval}`;
  const cached = historyCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const chart = (await yahooFinance.chart(
      symbol,
      {
        range: normalizedRange,
        interval: normalizedInterval,
        return: "object"
      } as unknown as Parameters<typeof yahooFinance.chart>[1]
    )) as ChartResponseLike;
    const quotes = chart.quotes ?? [];
    const candles: HistoryCandle[] = quotes
      .map((point: ChartQuote) => {
        const isoDate =
          point.date instanceof Date
            ? point.date.toISOString()
            : typeof point.timestamp === "number"
              ? new Date(point.timestamp * 1000).toISOString()
              : null;

        if (!isoDate) {
          return null;
        }

        return {
          date: isoDate,
          open: sanitizePoint(point.open),
          high: sanitizePoint(point.high),
          low: sanitizePoint(point.low),
          close: sanitizePoint(point.close),
          volume: typeof point.volume === "number" ? point.volume : null
        } satisfies HistoryCandle;
      })
      .filter((entry): entry is HistoryCandle => entry !== null);

    historyCache.set(key, candles);
    return candles;
  } catch (error) {
    console.error("Yahoo Finance history failed", error);
    if (process.env.ENABLE_STOOQ_FALLBACK === "true") {
      const fallback = await fetchStooqHistory(symbol);
      if (fallback) {
        historyCache.set(key, fallback);
        return fallback;
      }
    }
    throw error;
  }
}

function sanitizePoint(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchStooqHistory(symbol: string): Promise<HistoryCandle[] | null> {
  try {
    const stooqSymbol = toStooqSymbol(symbol);
    if (!stooqSymbol) {
      return null;
    }
    const response = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`);
    if (!response.ok) {
      return null;
    }
    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length <= 1) {
      return null;
    }
    const [, ...rows] = lines;
    return rows
      .map((row: string) => {
        const [date, open, high, low, close, volume] = row.split(",");
        return {
          date,
          open: parseFloatOrNull(open),
          high: parseFloatOrNull(high),
          low: parseFloatOrNull(low),
          close: parseFloatOrNull(close),
          volume: parseFloatOrNull(volume)
        } as HistoryCandle;
      })
      .filter((entry): entry is HistoryCandle => Boolean(entry.date));
  } catch (error) {
    console.error("Stooq fallback failed", error);
    return null;
  }
}

function parseFloatOrNull(value: string | undefined) {
  if (!value) {
    return null;
  }
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

const STOOQ_SUFFIX_MAP: Record<string, string> = {
  "": "us",
  PA: "fr",
  L: "uk",
  DE: "de",
  HK: "hk",
  NS: "in",
  BO: "bo",
  MI: "mi",
  AX: "au",
  NZ: "nz",
  SA: "sa",
  MX: "mx",
  TO: "to",
  V: "v",
  SI: "sg",
  TW: "tw",
  KS: "ks",
  KQ: "kq",
  TA: "ta",
  SN: "sn",
  JK: "jk"
};

function toStooqSymbol(symbol: string): string | null {
  const cleaned = symbol.trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith("^")) {
    return `${cleaned.slice(1).toLowerCase()}.us`;
  }
  const [base, suffix = ""] = cleaned.split(".");
  const stooqSuffix = STOOQ_SUFFIX_MAP[suffix.toUpperCase() as keyof typeof STOOQ_SUFFIX_MAP];
  if (!stooqSuffix) {
    return null;
  }
  return `${base.toLowerCase()}.${stooqSuffix}`;
}

