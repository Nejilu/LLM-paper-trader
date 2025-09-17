"use client";

import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AssetClass } from "@/hooks/api";
import { useSearch } from "@/hooks/api";

const ALL_FILTERS: AssetClass[] = ["equity", "etf", "etn", "index"];

interface SearchBarProps {
  onSymbolSelect?: (symbol: string) => void;
}

export function SearchBar({ onSymbolSelect }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AssetClass[]>(ALL_FILTERS);
  const { data, isLoading } = useSearch(query, filters);

  const results = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    if (!query.trim()) {
      return data;
    }
    const fuse = new Fuse(data, {
      keys: ["name", "ticker", "yahooSymbol"],
      threshold: 0.3
    });
    return fuse.search(query).map((match) => match.item);
  }, [data, query]);

  const toggleFilter = (filter: AssetClass) => {
    setFilters((prev) => {
      if (prev.includes(filter)) {
        const next = prev.filter((item) => item !== filter);
        return next.length ? next : [filter];
      }
      return [...prev, filter];
    });
  };

  const handleResultClick = (rawSymbol: string) => {
    const resolved = rawSymbol.trim();
    if (!resolved) {
      return;
    }
    if (onSymbolSelect) {
      setQuery(resolved);
      onSymbolSelect(resolved);
    } else {
      router.push(`/symbol/${encodeURIComponent(resolved)}`);
    }
  };

  return (
    <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or ticker"
            className="w-full rounded-lg border border-border px-4 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="flex flex-wrap gap-2">
            {ALL_FILTERS.map((filter) => {
              const active = filters.includes(filter);
              return (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${active ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted"}`}
                >
                  {filter.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
          {!isLoading && results.length === 0 && query.length >= 2 && (
            <p className="text-sm text-muted-foreground">No matches found.</p>
          )}
          <ul className="divide-y divide-border">
            {results.map((item) => {
              const symbol = item.yahooSymbol ?? item.ticker;
              return (
                <li
                  key={`${item.ticker}-${item.yahooSymbol ?? "unknown"}`}
                  className="flex cursor-pointer items-center justify-between gap-4 py-3 transition hover:bg-muted"
                  onClick={() => handleResultClick(symbol)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{item.ticker}</span>
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="uppercase">{item.assetType}</div>
                    <div>{item.exchangeCode ?? item.mic ?? ""}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}


