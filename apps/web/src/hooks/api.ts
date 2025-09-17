import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "./useDebouncedValue";

export type AssetClass = "equity" | "etf" | "etn" | "index";

export interface SearchResultItem {
  name: string;
  ticker: string;
  mic?: string;
  exchangeCode?: string;
  assetType: AssetClass;
  yahooSymbol?: string | null;
  source: "openfigi" | "yahoo";
}

export interface QuoteResponse {
  symbol: string;
  price: number | null;
  currency?: string;
  changePercent?: number | null;
  change?: number | null;
  marketState?: string;
  previousClose?: number | null;
  timestamp?: number | null;
}

export interface HistoryCandle {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface PortfolioPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  dailyPnL: number | null;
  changePercent?: number | null;
}

export interface Portfolio {
  id: number;
  name: string;
  baseCurrency: string;
}

export interface PortfolioSnapshot {
  id: number;
  name: string;
  baseCurrency: string;
  cashBalance: number;
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPnL: number;
  totalDailyPnL: number;
  positions: PortfolioPosition[];
}

export interface TradeDto {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  ts: string;
}

interface SearchResponse {
  results: SearchResultItem[];
}

interface TradesResponse {
  trades: TradeDto[];
}

export function useSearch(query: string, filters: AssetClass[]) {
  const debounced = useDebouncedValue(query, 300);
  const filterParam = filters.slice().sort().join(",");
  return useQuery({
    queryKey: ["search", debounced, filterParam],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({ q: debounced, types: filterParam });
      const { results } = await apiFetch<SearchResponse>(`/api/search?${params.toString()}`);
      return results;
    },
    staleTime: 60_000
  });
}

export function useQuote(symbol?: string) {
  return useQuery({
    queryKey: ["quote", symbol],
    enabled: Boolean(symbol),
    queryFn: () => apiFetch<QuoteResponse>(`/api/quote?symbol=${encodeURIComponent(symbol ?? "")}`),
    staleTime: 60_000
  });
}

export function useHistory(symbol?: string, range = "6M", interval = "1d") {
  return useQuery({
    queryKey: ["history", symbol, range, interval],
    enabled: Boolean(symbol),
    queryFn: () =>
      apiFetch<{ candles: HistoryCandle[] }>(
        `/api/history?symbol=${encodeURIComponent(symbol ?? "")}&range=${range}&interval=${interval}`
      ),
    staleTime: 5 * 60_000
  });
}

export function usePortfolios() {
  return useQuery({
    queryKey: ["portfolios"],
    queryFn: () => apiFetch<{ portfolios: Portfolio[] }>("/api/portfolios"),
    staleTime: 60_000
  });
}

export function usePortfolio(portfolioId?: number) {
  return useQuery({
    queryKey: ["portfolio", portfolioId],
    queryFn: () => apiFetch<PortfolioSnapshot>(portfolioId ? `/api/portfolio?portfolioId=${portfolioId}` : "/api/portfolio"),
    staleTime: 30_000
  });
}

export function useTrades(portfolioId?: number) {
  return useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => apiFetch<TradesResponse>(portfolioId ? `/api/trades?portfolioId=${portfolioId}` : "/api/trades"),
    staleTime: 60_000
  });
}

interface PlaceTradeInput {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price?: number;
  portfolioId?: number;
}

export function usePlaceTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlaceTradeInput) =>
      apiFetch<PortfolioSnapshot>("/api/trades", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["trades", variables.portfolioId] });
    }
  });
}

export interface EquityPoint {
  date: string;
  value: number;
}

export function useEquityCurve(positions: PortfolioPosition[], range = "6M") {
  const symbols = useMemo(() => positions.map((position) => position.symbol).sort(), [positions]);
  return useQuery({
    queryKey: ["equity-curve", symbols, range],
    enabled: symbols.length > 0,
    queryFn: async () => {
      const histories = await Promise.all(
        positions.map((position) =>
          apiFetch<{ candles: HistoryCandle[] }>(
            `/api/history?symbol=${encodeURIComponent(position.symbol)}&range=${range}&interval=1d`
          )
        )
      );
      const totals = new Map<string, number>();
      positions.forEach((position, index) => {
        const candles = histories[index]?.candles ?? [];
        candles.forEach((candle) => {
          if (!candle.date || candle.close === null || candle.close === undefined) {
            return;
          }
          const existing = totals.get(candle.date) ?? 0;
          totals.set(candle.date, existing + position.qty * candle.close);
        });
      });
      return Array.from(totals.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([date, value]) => ({ date, value }));
    },
    staleTime: 5 * 60_000
  });
}
