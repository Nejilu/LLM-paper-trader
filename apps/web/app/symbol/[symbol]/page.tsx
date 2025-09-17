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
      ? "text-emerald-600"
      : "text-rose-600"
    : "text-slate-500";

  const historyCandles = useMemo(() => historyQuery.data?.candles ?? [], [historyQuery.data]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-700">
          Dashboard
        </Link>{" "}/ {symbol}
      </nav>
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-slate-900">{symbol}</h1>
          <span className="text-xs uppercase text-slate-500">{quoteQuery.data?.marketState}</span>
        </div>
        <div className="text-2xl font-semibold text-slate-900">
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
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Price History</h2>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  range === option.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            <p className="text-sm text-slate-500">No historical data for this range.</p>
          )}
        </div>
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Add Trade</h2>
        <p className="mb-3 text-sm text-slate-500">Record a simulated trade for {symbol}.</p>
        <TradeForm symbol={symbol} />
      </section>
    </main>
  );
}
