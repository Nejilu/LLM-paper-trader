import { Prisma, prisma } from "@paper-trading/db";
import {
  applyTrade,
  computePortfolioTotals,
  computePositionDto,
  createTradeRecord,
  ensurePortfolio,
  sortPositions,
  TradeInput
} from "./portfolio";
import { getQuote } from "./yahoo";
import { PortfolioSnapshot } from "./types";

export const DEFAULT_PORTFOLIO_ID = 1;
export const INITIAL_CASH_BALANCE = new Prisma.Decimal(100000);

export function parsePortfolioIdParam(value: unknown): number {
  if (Array.isArray(value)) {
    return parsePortfolioIdParam(value[0]);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORTFOLIO_ID;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_PORTFOLIO_ID;
  }
  return DEFAULT_PORTFOLIO_ID;
}

export function parsePortfolioIdStrict(value: unknown): number {
  const parsed = parsePortfolioIdParam(value);
  if (parsed === DEFAULT_PORTFOLIO_ID) {
    if (Array.isArray(value)) {
      return parsePortfolioIdStrict(value[0]);
    }
    if (typeof value === "string" && value.trim() !== String(DEFAULT_PORTFOLIO_ID)) {
      throw new Error("Invalid portfolio id");
    }
    if (typeof value === "number" && value !== DEFAULT_PORTFOLIO_ID) {
      throw new Error("Invalid portfolio id");
    }
  }
  return parsed;
}

export async function getPortfolioRecord(portfolioId: number) {
  if (portfolioId === DEFAULT_PORTFOLIO_ID) {
    return prisma.portfolio.upsert({
      where: { id: DEFAULT_PORTFOLIO_ID },
      update: {},
      create: {
        name: "Default",
        baseCurrency: "USD",
        cashBalance: INITIAL_CASH_BALANCE
      }
    });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId }
  });

  if (!portfolio) {
    throw new Error(`Portfolio with ID ${portfolioId} not found`);
  }

  return portfolio;
}

export function decimalToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

export async function deriveMarketPrice(symbol: string): Promise<number> {
  const quote = await getQuote(symbol);
  if (quote.price !== null && quote.price !== undefined) {
    return quote.price;
  }
  if (quote.previousClose !== null && quote.previousClose !== undefined) {
    return quote.previousClose;
  }
  throw new Error("Unable to derive price for trade");
}

export async function buildPortfolioSnapshot(
  portfolioId: number = DEFAULT_PORTFOLIO_ID
): Promise<PortfolioSnapshot> {
  const portfolioRecord = await getPortfolioRecord(portfolioId);
  const base = ensurePortfolio(portfolioRecord);
  const cashBalance = decimalToNumber(base.cashBalance);

  const positions = await prisma.position.findMany({
    where: { portfolioId }
  });

  const quotes = await Promise.all(positions.map((position) => getQuote(position.symbol)));
  const positionDtos = positions.map((position, index) =>
    computePositionDto(position, quotes[index] ?? { price: null })
  );
  const totals = computePortfolioTotals(positionDtos);

  return {
    id: base.id,
    name: base.name,
    baseCurrency: base.baseCurrency,
    cashBalance,
    totalMarketValue: totals.totalMarketValue,
    totalCostBasis: totals.totalCostBasis,
    totalUnrealizedPnL: totals.totalUnrealizedPnL,
    totalDailyPnL: totals.totalDailyPnL,
    positions: sortPositions(positionDtos)
  };
}

export async function executeTradeInputs(
  trades: TradeInput[],
  portfolioId: number
): Promise<void> {
  if (trades.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const portfolio = await tx.portfolio.findUnique({
      where: { id: portfolioId }
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    for (const tradeInput of trades) {
      const qtyDecimal = new Prisma.Decimal(tradeInput.qty);
      const priceDecimal = new Prisma.Decimal(tradeInput.price);
      const tradeCost = qtyDecimal.mul(priceDecimal);
      const currentCash = new Prisma.Decimal(portfolio.cashBalance);

      if (tradeInput.side === "BUY") {
        if (currentCash.lt(tradeCost)) {
          throw new Error("Insufficient cash balance for this trade");
        }
        portfolio.cashBalance = currentCash.sub(tradeCost);
        await tx.portfolio.update({
          where: { id: portfolioId },
          data: { cashBalance: portfolio.cashBalance }
        });
      } else {
        portfolio.cashBalance = currentCash.add(tradeCost);
        await tx.portfolio.update({
          where: { id: portfolioId },
          data: { cashBalance: portfolio.cashBalance }
        });
      }

      const existingPosition = await tx.position.findFirst({
        where: {
          portfolioId,
          symbol: tradeInput.symbol
        }
      });

      const updated = applyTrade(existingPosition ?? null, tradeInput);

      if (!existingPosition) {
        if (tradeInput.side === "SELL") {
          throw new Error("Cannot sell a position that does not exist");
        }
        await tx.position.create({
          data: {
            portfolioId,
            symbol: tradeInput.symbol,
            qty: updated.qty,
            avgPrice: updated.avgPrice
          }
        });
      } else if (updated.qty.isZero()) {
        await tx.position.delete({ where: { id: existingPosition.id } });
      } else {
        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            qty: updated.qty,
            avgPrice: updated.avgPrice
          }
        });
      }

      await tx.trade.create({
        data: createTradeRecord(tradeInput, portfolioId)
      });
    }
  });
}


