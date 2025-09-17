"use client";

import type { PortfolioSnapshot } from "@/hooks/api";

interface PortfolioSummaryProps {
  portfolio?: PortfolioSnapshot;
}

export function PortfolioSummary({ portfolio }: PortfolioSummaryProps) {
  if (!portfolio) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading portfolio...</p>
      </div>
    );
  }

  const totalValue = portfolio.totalMarketValue + portfolio.cashBalance;
  const metrics = [
    {
      label: "Cash Balance",
      value: formatCurrency(portfolio.cashBalance, portfolio.baseCurrency)
    },
    {
      label: "Total Value",
      value: formatCurrency(totalValue, portfolio.baseCurrency)
    },
    {
      label: "Cost Basis",
      value: formatCurrency(portfolio.totalCostBasis, portfolio.baseCurrency)
    },
    {
      label: "Unrealized PnL",
      value: formatCurrency(portfolio.totalUnrealizedPnL, portfolio.baseCurrency)
    }
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{portfolio.name}</h2>
          <p className="text-sm text-muted-foreground">Base currency: {portfolio.baseCurrency}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
            <dd className="mt-2 text-lg font-semibold text-foreground">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString(undefined, { style: "currency", currency });
}


