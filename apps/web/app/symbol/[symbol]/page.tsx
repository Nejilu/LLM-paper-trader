"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PriceChart } from "@/components/price-chart";
import { TradeForm } from "@/components/trade-form";
import { useHistory, useQuote } from "@/hooks/api";

const RANGE_OPTIONS: { label: string; value: "1mo" | "6mo" | "1y" }[] = [
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" }
];

export default function SymbolPage() {
  const params = useParams<{ symbol: string }>();
  const symbolParam = params?.symbol ?? "";
  const symbol = decodeURIComponent(Array.isArray(symbolParam) ? symbolParam[0] : symbolParam);
  const [range, setRange] = useState<"1mo" | "6mo" | "1y">("6mo");

  const quoteQuery = useQuote(symbol);
  const historyQuery = useHistory(symbol, range, "1d");

  const changeClass = quoteQuery.data?.change
    ? quoteQuery.data.change >= 0
      ? "text-emerald-500"
      : "text-rose-500"
    : "text-muted-foreground";

  const historyCandles = useMemo(() => historyQuery.data?.candles ?? [], [historyQuery.data]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/" className="transition hover:text-foreground">
          Dashboard
        </Link>{" "}/ {symbol}
      </nav>
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">{symbol}</h1>
          <span className="text-xs uppercase text-muted-foreground">{quoteQuery.data?.marketState}</span>
        </div>
        <div className="text-2xl font-semibold text-foreground">
          {quoteQuery.data?.price !== null && quoteQuery.data?.price !== undefined
            ? quoteQuery.data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : "--"}
        </div>
        <div className={`text-sm ${changeClass}`}>
          {quoteQuery.data?.change !== null && quoteQuery.data?.change !== undefined
            ? `${quoteQuery.data.change.toFixed(2)} (${(quoteQuery.data.changePercent ?? 0).toFixed(2)}%)`
            : ""}
        </div>
      </header>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Price History</h2>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  range === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {historyCandles.length > 0 ? (
            <PriceChart candles={historyCandles} />
          ) : (
            <p className="text-sm text-muted-foreground">No historical data for this range.</p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Add Trade</h2>
        <p className="mb-3 text-sm text-muted-foreground">Record a simulated trade for {symbol}.</p>
        <TradeForm symbol={symbol} />
      </section>
    </main>
  );
}
