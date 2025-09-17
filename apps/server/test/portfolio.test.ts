import { describe, expect, it } from "vitest";
import { Prisma, type Position } from "@paper-trading/db";
import { applyTrade, computePositionDto } from "../src/portfolio";

describe("applyTrade", () => {
  it("computes a new average price for buy trades", () => {
    const position = mockPosition({ qty: 10, avgPrice: 100 });
    const result = applyTrade(position, { symbol: "AAPL", side: "BUY", qty: 5, price: 110 });

    expect(result.qty.toNumber()).toBeCloseTo(15);
    expect(result.avgPrice.toNumber()).toBeCloseTo((10 * 100 + 5 * 110) / 15);
  });

  it("reduces quantity for sells and keeps avg price", () => {
    const position = mockPosition({ qty: 10, avgPrice: 120 });
    const result = applyTrade(position, { symbol: "AAPL", side: "SELL", qty: 4, price: 130 });

    expect(result.qty.toNumber()).toBeCloseTo(6);
    expect(result.avgPrice.toNumber()).toBeCloseTo(120);
  });

  it("throws when selling more than available", () => {
    const position = mockPosition({ qty: 2, avgPrice: 50 });
    expect(() => applyTrade(position, { symbol: "AAPL", side: "SELL", qty: 3, price: 60 })).toThrow(
      "Cannot sell more shares than currently held"
    );
  });
});

describe("computePositionDto", () => {
  it("computes market value and PnL statistics", () => {
    const position = mockPosition({ qty: 8, avgPrice: 95, symbol: "MSFT" });
    const dto = computePositionDto(position, { price: 100, change: 2, changePercent: 2 });

    expect(dto.marketPrice).toBe(100);
    expect(dto.marketValue).toBeCloseTo(800);
    expect(dto.unrealizedPnL).toBeCloseTo(40);
    expect(dto.dailyPnL).toBeCloseTo(16);
  });
});

function mockPosition({
  qty,
  avgPrice,
  symbol = "AAPL"
}: {
  qty: number;
  avgPrice: number;
  symbol?: string;
}): Position {
  return {
    id: 1,
    portfolioId: 1,
    symbol,
    qty: new Prisma.Decimal(qty),
    avgPrice: new Prisma.Decimal(avgPrice)
  } as unknown as Position;
}
