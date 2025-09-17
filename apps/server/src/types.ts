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

export interface PortfolioPositionDto {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  dailyPnL: number | null;
  changePercent?: number | null;
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
  positions: PortfolioPositionDto[];
}
