"use client";

import { useRouter } from "next/navigation";
import type { PortfolioPosition } from "@/hooks/api";

interface PositionsTableProps {
  positions: PortfolioPosition[];
  baseCurrency: string;
  onSelectSymbol?: (symbol: string) => void;
}

export function PositionsTable({ positions, baseCurrency, onSelectSymbol }: PositionsTableProps) {
  const router = useRouter();

  if (!positions.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">Positions</h3>
        <p className="mt-2 text-sm text-muted-foreground">No open positions yet.</p>
      </div>
    );
  }

  const handleRowClick = (rawSymbol: string) => {
    const symbol = rawSymbol.trim();
    if (!symbol) {
      return;
    }
    if (onSelectSymbol) {
      onSelectSymbol(symbol);
    } else {
      router.push(`/symbol/${encodeURIComponent(symbol)}`);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">Positions</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Avg Price</th>
              <th className="px-3 py-2 text-right">Last Price</th>
              <th className="px-3 py-2 text-right">Market Value</th>
              <th className="px-3 py-2 text-right">Unrealized PnL</th>
              <th className="px-3 py-2 text-right">Daily PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {positions.map((position) => (
              <tr
                key={position.symbol}
                className="cursor-pointer transition hover:bg-muted"
                onClick={() => handleRowClick(position.symbol)}
              >
                <td className="px-3 py-2 font-medium text-foreground">{position.symbol}</td>
                <td className="px-3 py-2 text-right">{formatNumber(position.qty, 4)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(position.avgPrice, baseCurrency)}</td>
                <td className="px-3 py-2 text-right">
                  {position.marketPrice !== null
                    ? formatCurrency(position.marketPrice, baseCurrency)
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  {position.marketValue !== null
                    ? formatCurrency(position.marketValue, baseCurrency)
                    : "-"}
                </td>
                <td className={`px-3 py-2 text-right ${valueClass(position.unrealizedPnL)}`}>
                  {position.unrealizedPnL !== null
                    ? formatCurrency(position.unrealizedPnL, baseCurrency)
                    : "-"}
                </td>
                <td className={`px-3 py-2 text-right ${valueClass(position.dailyPnL)}`}>
                  {position.dailyPnL !== null
                    ? formatCurrency(position.dailyPnL, baseCurrency)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString(undefined, { style: "currency", currency });
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
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


