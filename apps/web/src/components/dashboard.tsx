"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EquityChart } from "@/components/equity-chart";
import { PortfolioManager } from "@/components/portfolio-manager";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { PositionsTable } from "@/components/positions-table";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TradeForm } from "@/components/trade-form";
import { useEquityCurve, usePortfolio, useQuote, useTrades, usePortfolios } from "@/hooks/api";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [currentPortfolioId, setCurrentPortfolioId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: portfolio } = usePortfolio(currentPortfolioId ?? undefined);
  const { data: portfoliosData } = usePortfolios();
  const { data: tradesData } = useTrades(currentPortfolioId ?? undefined);
  const equityQuery = useEquityCurve(portfolio?.positions ?? [], "6mo");
  const quoteQuery = useQuote(selectedSymbol ?? undefined);
  const latestTrades = tradesData?.trades.slice(0, 5) ?? [];

  // Auto-select first portfolio if none is selected
  useEffect(() => {
    if (!currentPortfolioId && portfoliosData?.portfolios?.length > 0) {
      setCurrentPortfolioId(portfoliosData.portfolios[0].id);
    }
  }, [portfoliosData, currentPortfolioId]);

  const handlePortfolioChange = (portfolioId: number) => {
    setCurrentPortfolioId(portfolioId);
  };

  const handlePortfolioCreate = async (name: string, baseCurrency: string) => {
    try {
      const created = await apiFetch<{ id: number }>("/api/portfolios", {
        method: "POST",
        body: JSON.stringify({ name, baseCurrency })
      });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      if (created?.id) {
        setCurrentPortfolioId(created.id);
      }
    } catch (error) {
      console.error("Failed to create portfolio", error);
    }
  };

  const handlePortfolioDelete = async (portfolioId: number) => {
    try {
      await apiFetch(`/api/portfolios/${portfolioId}`, { method: "DELETE" });
      setCurrentPortfolioId(null);
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    } catch (error) {
      console.error("Failed to delete portfolio", error);
    }
  };

  const handlePortfolioReset = async (portfolioId: number) => {
    try {
      await apiFetch(`/api/portfolios/${portfolioId}/reset`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
    } catch (error) {
      console.error("Failed to reset portfolio", error);
    }
  };

  const handleExportPortfolio = async (portfolioId: number) => {
    try {
      const data = await apiFetch<Record<string, unknown>>(`/api/portfolios/${portfolioId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `portfolio-${portfolioId}-${new Date().toISOString().split("T")[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export portfolio", error);
    }
  };

  const handleImportPortfolio = (data: unknown) => {
    console.log("Import portfolio data:", data);
  };

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const quote = quoteQuery.data;
  const isQuoteLoading = quoteQuery.isLoading;
  const isQuoteRefreshing = quoteQuery.isFetching && Boolean(quote);
  const currencyForFormatting = quote?.currency ?? portfolio?.baseCurrency;
  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "--";
    }
    if (currencyForFormatting) {
      return value.toLocaleString(undefined, { style: "currency", currency: currencyForFormatting });
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  const changeClass =
    typeof quote?.change === "number"
      ? quote.change > 0
        ? "text-emerald-600"
        : quote.change < 0
          ? "text-rose-600"
          : "text-muted-foreground"
      : "text-muted-foreground";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Paper Trading Desk</h1>
          <p className="text-sm text-muted-foreground">
            Search across global markets, simulate trades, and visualise your paper portfolio.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/llm"
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            LLM console
          </Link>
          {portfoliosData && (
            <PortfolioManager
              currentPortfolio={portfolio || portfoliosData.portfolios[0]}
              onPortfolioChange={handlePortfolioChange}
              onPortfolioCreate={handlePortfolioCreate}
              onPortfolioDelete={handlePortfolioDelete}
              onPortfolioReset={handlePortfolioReset}
              onExportPortfolio={handleExportPortfolio}
              onImportPortfolio={handleImportPortfolio}
              portfolios={portfoliosData.portfolios}
            />
          )}
          <ThemeToggle />
        </div>
      </header>
      <SearchBar onSymbolSelect={handleSelectSymbol} />
      {selectedSymbol && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Selected instrument</h2>
              <p className="text-sm text-muted-foreground">Prepare a simulated trade for {selectedSymbol}.</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/symbol/${encodeURIComponent(selectedSymbol)}`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                Open details
              </Link>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-border hover:text-foreground"
                onClick={() => setSelectedSymbol(null)}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              {isQuoteLoading ? (
                <p className="text-sm text-muted-foreground">Loading quote...</p>
              ) : quoteQuery.isError ? (
                <p className="text-sm text-rose-600">Unable to load quote data.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-3xl font-semibold text-foreground">{formatPrice(quote?.price)}</div>
                  {typeof quote?.change === "number" && (
                    <div className={`text-sm ${changeClass}`}>
                      {quote.change.toFixed(2)}
                      {typeof quote.changePercent === "number" ? ` (${quote.changePercent.toFixed(2)}%)` : ""}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {quote?.marketState ?? "MARKET"}
                    {quote?.timestamp ? ` - ${new Date(quote.timestamp).toLocaleString()}` : ""}
                  </div>
                  {isQuoteRefreshing && <span className="text-xs text-muted-foreground">Refreshing...</span>}
                </div>
              )}
            </div>
            <div>
              <TradeForm symbol={selectedSymbol} portfolioId={currentPortfolioId ?? undefined} />
            </div>
          </div>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortfolioSummary portfolio={portfolio} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Equity Curve (6M)</h3>
          {equityQuery.data && equityQuery.data.length > 0 ? (
            <div className="mt-4">
              <EquityChart data={equityQuery.data} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No historical data available yet.</p>
          )}
        </div>
      </div>
      <PositionsTable
        positions={portfolio?.positions ?? []}
        baseCurrency={portfolio?.baseCurrency ?? "USD"}
        onSelectSymbol={handleSelectSymbol}
      />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Latest Trades</h3>
          <Link href="/trades" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>
        {latestTrades.length > 0 ? (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Side</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {latestTrades.map((trade) => (
                <tr key={trade.id}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(trade.ts).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{trade.symbol}</td>
                  <td className={`px-3 py-2 font-semibold ${trade.side === "BUY" ? "text-emerald-600" : "text-rose-600"}`}>
                    {trade.side}
                  </td>
                  <td className="px-3 py-2 text-right">{trade.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    {trade.price.toLocaleString(undefined, {
                      style: "currency",
                      currency: portfolio?.baseCurrency ?? "USD"
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
        )}
      </div>
    </main>
  );
}
























