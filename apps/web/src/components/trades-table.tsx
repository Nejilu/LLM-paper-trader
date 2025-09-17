"use client";

import { useMemo, useState } from "react";
import type { TradeDto } from "@/hooks/api";

interface TradesTableProps {
  trades: TradeDto[];
  baseCurrency: string;
  priceLookup?: Record<string, number | null | undefined>;
}

export function TradesTable({ trades, baseCurrency, priceLookup = {} }: TradesTableProps) {
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const filtered = useMemo(() => {
    return trades
      .filter((trade) => (sideFilter === "ALL" ? true : trade.side === sideFilter))
      .filter((trade) =>
        symbolFilter ? trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase()) : true
      )
      .filter((trade) => {
        if (!fromDate && !toDate) {
          return true;
        }
        const tradeDate = new Date(trade.ts);
        if (fromDate && tradeDate < new Date(fromDate)) {
          return false;
        }
        if (toDate && tradeDate > new Date(toDate)) {
          return false;
        }
        return true;
      });
  }, [trades, sideFilter, symbolFilter, fromDate, toDate]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h3 className="text-base font-semibold text-foreground">Trades</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Symbol"
            value={symbolFilter}
            onChange={(event) => setSymbolFilter(event.target.value)}
            className="w-28 rounded-lg border border-border px-3 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {(["ALL", "BUY", "SELL"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setSideFilter(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                sideFilter === value ? "bg-brand-600 text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {filtered.map((trade) => {
              const currentPrice = priceLookup[trade.symbol];
              const pnl =
                currentPrice !== undefined && currentPrice !== null
                  ? calculateTradePnL(trade, currentPrice)
                  : null;
              return (
                <tr key={trade.id}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(trade.ts).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{trade.symbol}</td>
                  <td className={`px-3 py-2 font-semibold ${trade.side === "BUY" ? "text-emerald-600" : "text-rose-600"}`}>
                    {trade.side}
                  </td>
                  <td className="px-3 py-2 text-right">{trade.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(trade.price, baseCurrency)}</td>
                  <td className={`px-3 py-2 text-right ${valueClass(pnl)}`}>
                    {pnl !== null ? formatCurrency(pnl, baseCurrency) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No trades matching the filters.</p>
        )}
      </div>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString(undefined, { style: "currency", currency });
}

function calculateTradePnL(trade: TradeDto, currentPrice: number) {
  const difference = trade.side === "BUY" ? currentPrice - trade.price : trade.price - currentPrice;
  return difference * trade.qty;
}

function valueClass(value: number | null) {
  if (value === null) {
    return "text-muted-foreground";
  }
  if (value > 0) {
    return "text-emerald-600";
  }
  if (value < 0) {
    return "text-rose-600";
  }
  return "text-muted-foreground";
}


