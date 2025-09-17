"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TradesTable } from "@/components/trades-table";
import { usePortfolio, useTrades } from "@/hooks/api";

export default function TradesPage() {
  const { data: tradesData } = useTrades();
  const { data: portfolio } = usePortfolio();

  const priceLookup = useMemo(() => {
    const map: Record<string, number | null | undefined> = {};
    portfolio?.positions.forEach((position) => {
      map[position.symbol] = position.marketPrice ?? null;
    });
    return map;
  }, [portfolio?.positions]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Trades</h1>
          <p className="text-sm text-slate-500">Review and filter your simulated trade history.</p>
        </div>
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to dashboard
        </Link>
      </header>
      <TradesTable
        trades={tradesData?.trades ?? []}
        baseCurrency={portfolio?.baseCurrency ?? "USD"}
        priceLookup={priceLookup}
      />
    </main>
  );
}
