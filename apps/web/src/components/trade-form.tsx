"use client";

import { useState } from "react";
import { usePlaceTrade } from "@/hooks/api";

interface TradeFormProps {
  symbol: string;
  portfolioId?: number;
  onSubmitted?: () => void;
}

export function TradeForm({ symbol, portfolioId, onSubmitted }: TradeFormProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = usePlaceTrade();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const qtyValue = Number(qty);
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    const priceValue = price ? Number(price) : undefined;
    if (price && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
      setError("Price must be positive");
      return;
    }
    try {
      await mutation.mutateAsync({ symbol, side, qty: qtyValue, price: priceValue, portfolioId });
      setQty("0");
      setPrice("");
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (tradeError) {
      setError(tradeError instanceof Error ? tradeError.message : "Unable to place trade");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["BUY", "SELL"] as const).map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setSide(value)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              side === value
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-border bg-card text-muted-foreground hover:border-border"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col text-sm">
          Quantity
          <input
            type="number"
            min="0"
            step="0.0001"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            className="mt-1 rounded-lg border border-border px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="flex flex-col text-sm">
          Price (optional)
          <input
            type="number"
            min="0"
            step="0.0001"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 rounded-lg border border-border px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? "Submitting..." : `Submit ${side}`}
      </button>
    </form>
  );
}

