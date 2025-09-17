import { Portfolio, Position, Prisma, Trade } from "@paper-trading/db";
import { PortfolioPositionDto } from "./types";

export type TradeSide = "BUY" | "SELL";

export interface TradeInput {
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
}

const DEFAULT_CASH_BALANCE = new Prisma.Decimal(100000);

export function ensurePortfolio(portfolio: Portfolio | null): Portfolio {
  if (portfolio) {
    return portfolio;
  }
  return {
    id: 1,
    name: "Default",
    baseCurrency: "USD",
    cashBalance: DEFAULT_CASH_BALANCE
  } as Portfolio;
}

export function applyTrade(position: Position | null, trade: TradeInput) {
  const qtyDelta = new Prisma.Decimal(trade.qty);
  const price = new Prisma.Decimal(trade.price);

  if (!position) {
    if (trade.side === "SELL") {
      throw new Error("Cannot sell a position that does not exist");
    }
    return {
      qty: qtyDelta,
      avgPrice: price
    };
  }

  const currentQty = position.qty;
  const currentAvg = position.avgPrice;

  if (trade.side === "BUY") {
    const newQty = currentQty.add(qtyDelta);
    const totalCost = currentAvg.mul(currentQty).add(price.mul(qtyDelta));
    const newAvg = newQty.isZero() ? new Prisma.Decimal(0) : totalCost.div(newQty);
    return {
      qty: newQty,
      avgPrice: newAvg
    };
  }

  if (qtyDelta.gt(currentQty)) {
    throw new Error("Cannot sell more shares than currently held");
  }

  const newQty = currentQty.sub(qtyDelta);
  const avgPrice = newQty.isZero() ? new Prisma.Decimal(0) : currentAvg;

  return {
    qty: newQty,
    avgPrice
  };
}

export function computePositionDto(
  position: Position,
  quote: {
    price: number | null;
    change?: number | null;
    changePercent?: number | null;
  }
): PortfolioPositionDto {
  const qty = position.qty.toNumber();
  const avgPrice = position.avgPrice.toNumber();
  const marketPrice = quote.price ?? null;
  const marketValue = marketPrice !== null ? qty * marketPrice : null;
  const costBasis = qty * avgPrice;
  const unrealizedPnL = marketPrice !== null ? marketValue! - costBasis : null;
  const dailyPnL = quote.change !== null && quote.change !== undefined ? qty * quote.change : null;

  return {
    symbol: position.symbol,
    qty,
    avgPrice,
    marketPrice,
    marketValue,
    unrealizedPnL,
    dailyPnL,
    changePercent: quote.changePercent ?? null
  };
}

export function computePortfolioTotals(positions: PortfolioPositionDto[]) {
  return positions.reduce(
    (acc, position) => {
      acc.totalMarketValue += position.marketValue ?? 0;
      acc.totalCostBasis += position.qty * position.avgPrice;
      acc.totalUnrealizedPnL += position.unrealizedPnL ?? 0;
      acc.totalDailyPnL += position.dailyPnL ?? 0;
      return acc;
    },
    {
      totalMarketValue: 0,
      totalCostBasis: 0,
      totalUnrealizedPnL: 0,
      totalDailyPnL: 0
    }
  );
}

export function sortPositions(positions: PortfolioPositionDto[]) {
  return [...positions].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function createTradeRecord(trade: TradeInput, portfolioId: number): Omit<Trade, "id"> {
  return {
    portfolioId,
    symbol: trade.symbol,
    side: trade.side,
    qty: new Prisma.Decimal(trade.qty),
    price: new Prisma.Decimal(trade.price),
    ts: new Date()
  };
}
