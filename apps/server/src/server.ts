import cors, { CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { prisma, Prisma } from "@paper-trading/db";
import type { Position, Trade } from "@paper-trading/db";
import yahooFinance from "yahoo-finance2";
import { z } from "zod";
import { OpenFigiClient } from "./openfigi";
import { resolveYahooSymbol } from "./resolveYahoo";
import { getHistory, getQuote } from "./yahoo";
import {
  applyTrade,
  computePortfolioTotals,
  computePositionDto,
  createTradeRecord,
  ensurePortfolio,
  sortPositions,
  TradeInput
} from "./portfolio";
import { AssetClass, PortfolioSnapshot, SearchResultItem } from "./types";
import { registerLlmRoutes } from "./llmRoutes";

const DEFAULT_PORTFOLIO_ID = 1;
const INITIAL_CASH_BALANCE = new Prisma.Decimal(100000);
const openFigiClient = new OpenFigiClient(process.env.OPENFIGI_API_KEY);

type YahooSearchQuote = {
  symbol?: string | null;
  shortname?: string | null;
  longname?: string | null;
  exchange?: string | null;
  exchangeDisplay?: string | null;
  quoteType?: string | null;
  [key: string]: unknown;
};

const searchQuerySchema = z.object({
  q: z.string().min(1),
  types: z
    .string()
    .optional()
    .transform((value) => parseAssetTypes(value)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Math.min(parseInt(value, 10) || 10, 25) : 10))
});

const tradeSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  qty: z.coerce.number().positive(),
  price: z.coerce.number().positive().optional(),
  portfolioId: z.coerce.number().int().positive().optional()
});

const portfolioSchema = z.object({
  name: z.string().min(1),
  baseCurrency: z.string().min(3).max(3)
});

const historySchema = z.object({
  symbol: z.string().min(1),
  range: z.string().default("1y"),
  interval: z.string().default("1d")
});

const parseOrigins = (raw?: string) =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const explicitOrigins = parseOrigins(process.env.CLIENT_ORIGIN);

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000"
];

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

const combinedOrigins = Array.from(
  new Set([
    ...explicitOrigins,
    ...(vercelUrl ? [vercelUrl] : []),
    ...(process.env.NODE_ENV !== "production" ? defaultDevOrigins : [])
  ])
);

const isVercelPreviewOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".vercel.app");
  } catch (error) {
    console.warn("Invalid origin provided to CORS", origin, error);
    return false;
  }
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (combinedOrigins.includes(origin) || isVercelPreviewOrigin(origin)) {
      return callback(null, true);
    }

    if (combinedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  }
};

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json());

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/search", async (req, res) => {
    try {
      const { q, types, limit } = searchQuerySchema.parse({
        q: typeof req.query.q === "string" ? req.query.q : Array.isArray(req.query.q) ? req.query.q[0] ?? "" : "",
        types: typeof req.query.types === "string" ? req.query.types : Array.isArray(req.query.types) ? req.query.types.join(",") : undefined,
        limit: typeof req.query.limit === "string" ? req.query.limit : Array.isArray(req.query.limit) ? req.query.limit[0] : undefined
      });

      const openFigiResults = await openFigiClient.search({ query: q, types, limit });
      const enriched = await enrichWithYahooSymbol(openFigiResults, q);

      let results: SearchResultItem[] = enriched;
      if (results.length < limit) {
        const yahooFallback = await searchDirectlyOnYahoo(q, limit - results.length, types);
        results = dedupeResults([...results, ...yahooFallback]);
      }

      res.json({ results: results.slice(0, limit) });
    } catch (error) {
      console.error("Search endpoint failed", error);
      res.status(400).json({ error: "Invalid search request" });
    }
  });

  app.get("/api/quote", async (req, res) => {
    const symbol = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }
    try {
      const quote = await getQuote(symbol);
      return res.json(quote);
    } catch (error) {
      console.error("Quote endpoint failed", error);
      return res.status(500).json({ error: "Unable to fetch quote" });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      const { symbol, range, interval } = historySchema.parse({
        symbol: req.query.symbol,
        range: req.query.range ?? "1y",
        interval: req.query.interval ?? "1d"
      });
      const candles = await getHistory(symbol, range, interval);
      res.json({ candles });
    } catch (error) {
      console.error("History endpoint failed", error);
      res.status(400).json({ error: "Invalid history request" });
    }
  });

  app.get("/api/portfolio", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdParam(req.query.portfolioId);
      const snapshot = await buildPortfolioSnapshot(portfolioId);
      res.json(snapshot);
    } catch (error) {
      console.error("Portfolio endpoint failed", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unable to fetch portfolio" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdParam(req.query.portfolioId);
      const trades = await prisma.trade.findMany({
        where: { portfolioId },
        orderBy: { ts: "desc" }
      });

      const normalized = trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        qty: trade.qty.toNumber(),
        price: trade.price.toNumber(),
        ts: trade.ts.toISOString()
      }));

      res.json({ trades: normalized });
    } catch (error) {
      console.error("Trades endpoint failed", error);
      res.status(500).json({ error: "Unable to fetch trades" });
    }
  });

  app.get("/api/portfolios", async (_req, res) => {
    try {
      await getPortfolioRecord(DEFAULT_PORTFOLIO_ID);
      const portfolios = await prisma.portfolio.findMany({
        orderBy: { id: "asc" }
      });

      const normalized = portfolios.map((portfolio) => ({
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency
      }));

      res.json({ portfolios: normalized });
    } catch (error) {
      console.error("Portfolios endpoint failed", error);
      res.status(500).json({ error: "Unable to fetch portfolios" });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const { name, baseCurrency } = portfolioSchema.parse(req.body);
      const normalizedCurrency = baseCurrency.toUpperCase();

      const portfolio = await prisma.portfolio.create({
        data: {
          name,
          baseCurrency: normalizedCurrency,
          cashBalance: INITIAL_CASH_BALANCE
        }
      });

      res.status(201).json({
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency,
        cashBalance: decimalToNumber(portfolio.cashBalance)
      });
    } catch (error) {
      console.error("Portfolio creation failed", error);
      res.status(400).json({ error: "Invalid portfolio creation request" });
    }
  });

  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);

      if (portfolioId === DEFAULT_PORTFOLIO_ID) {
        return res.status(400).json({ error: "Cannot delete default portfolio" });
      }

      await getPortfolioRecord(portfolioId);

      await prisma.$transaction(async (tx) => {
        await tx.trade.deleteMany({
          where: { portfolioId }
        });

        await tx.position.deleteMany({
          where: { portfolioId }
        });

        await tx.portfolio.delete({
          where: { id: portfolioId }
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Portfolio deletion failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio deletion request" });
    }
  });

  app.post("/api/portfolios/:id/reset", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);

      await getPortfolioRecord(portfolioId);

      await prisma.$transaction(async (tx) => {
        await tx.trade.deleteMany({
          where: { portfolioId }
        });

        await tx.position.deleteMany({
          where: { portfolioId }
        });

        await tx.portfolio.update({
          where: { id: portfolioId },
          data: { cashBalance: INITIAL_CASH_BALANCE }
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Portfolio reset failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio reset request" });
    }
  });

  app.get("/api/portfolios/:id/export", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);

      const portfolio = await prisma.portfolio.findUnique({
        where: { id: portfolioId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      const positions = await prisma.position.findMany({
        where: { portfolioId }
      });

      const trades = await prisma.trade.findMany({
        where: { portfolioId },
        orderBy: { ts: "desc" }
      });

      const exportData = {
        portfolio: {
          name: portfolio.name,
          baseCurrency: portfolio.baseCurrency,
          cashBalance: decimalToNumber(portfolio.cashBalance),
          exportedAt: new Date().toISOString()
        },
        positions: positions.map((position: Position) => ({
          symbol: position.symbol,
          qty: position.qty.toNumber(),
          avgPrice: position.avgPrice.toNumber()
        })),
        trades: trades.map((trade: Trade) => ({
          symbol: trade.symbol,
          side: trade.side,
          qty: trade.qty.toNumber(),
          price: trade.price.toNumber(),
          timestamp: trade.ts.toISOString()
        }))
      };

      res.json(exportData);
    } catch (error) {
      console.error("Portfolio export failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio export request" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const body = tradeSchema.parse(req.body);
      const portfolioId = body.portfolioId ?? DEFAULT_PORTFOLIO_ID;
      const symbol = body.symbol.toUpperCase();
      const price = body.price ?? (await deriveMarketPrice(symbol));
      const tradeInput: TradeInput = {
        symbol,
        side: body.side,
        qty: body.qty,
        price
      };

      if (!Number.isFinite(tradeInput.price)) {
        return res.status(422).json({ error: "Unable to determine trade price" });
      }

      await getPortfolioRecord(portfolioId);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const portfolio = await tx.portfolio.findUnique({
          where: { id: portfolioId }
        });

        if (!portfolio) {
          throw new Error("Portfolio not found");
        }

        const qtyDecimal = new Prisma.Decimal(tradeInput.qty);
        const priceDecimal = new Prisma.Decimal(tradeInput.price);
        const tradeCost = qtyDecimal.mul(priceDecimal);
        const currentCash = new Prisma.Decimal(portfolio.cashBalance);

        if (tradeInput.side === "BUY") {
          if (currentCash.lt(tradeCost)) {
            throw new Error("Insufficient cash balance for this trade");
          }
          await tx.portfolio.update({
            where: { id: portfolioId },
            data: { cashBalance: currentCash.sub(tradeCost) }
          });
        } else {
          await tx.portfolio.update({
            where: { id: portfolioId },
            data: { cashBalance: currentCash.add(tradeCost) }
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
      });

      const snapshot = await buildPortfolioSnapshot(portfolioId);
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Trade creation failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid trade request" });
    }
  });

  registerLlmRoutes(app);
  return app;
}

const app = createServer();
export default app;

function parseAssetTypes(value?: string | null): AssetClass[] {
  if (!value) {
    return ["equity", "etf", "etn", "index"];
  }
  const allowed: AssetClass[] = ["equity", "etf", "etn", "index"];
  const parts = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is AssetClass => (allowed as string[]).includes(part));
  return parts.length ? parts : allowed;
}

function dedupeResults(results: SearchResultItem[]) {
  const seen = new Set<string>();
  const deduped: SearchResultItem[] = [];
  for (const item of results) {
    const key = `${(item.yahooSymbol ?? item.ticker).toUpperCase()}|${item.assetType}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

async function enrichWithYahooSymbol(results: SearchResultItem[], userQuery: string) {
  return Promise.all(
    results.map(async (result) => {
      const resolution = await resolveYahooSymbol({
        userQuery,
        ticker: result.ticker,
        name: result.name,
        mic: result.mic ?? null,
        assetType: result.assetType
      });
      return {
        ...result,
        yahooSymbol: resolution?.yahooSymbol ?? null
      };
    })
  );
}

async function searchDirectlyOnYahoo(query: string, limit: number, types?: AssetClass[]) {
  if (limit <= 0) {
    return [] as SearchResultItem[];
  }
  try {
    const searchResult = await yahooFinance.search(query, { quotesCount: Math.min(limit * 2, 20), newsCount: 0 });
    const quotes = (searchResult.quotes ?? []) as YahooSearchQuote[];
    const seen = new Set<string>();
    const allowedTypes = new Set(types && types.length ? types : ["equity", "etf", "etn", "index"]);

    const mapped: SearchResultItem[] = [];
    for (const quote of quotes) {
      if (!quote.symbol) {
        continue;
      }
      if (seen.has(quote.symbol)) {
        continue;
      }
      const assetType = mapYahooQuoteType(quote.quoteType);
      if (assetType && !allowedTypes.has(assetType)) {
        continue;
      }
      mapped.push({
        name: quote.shortname ?? quote.longname ?? quote.symbol,
        ticker: quote.symbol.split(".")[0],
        mic: quote.exchange ?? undefined,
        exchangeCode: quote.exchangeDisplay ?? undefined,
        assetType: assetType ?? "equity",
        yahooSymbol: quote.symbol,
        source: "yahoo"
      });
      seen.add(quote.symbol);
      if (mapped.length >= limit) {
        break;
      }
    }
    return mapped;
  } catch (error) {
    console.error("Yahoo fallback search failed", error);
    return [];
  }
}

function mapYahooQuoteType(quoteType?: string | null): AssetClass | undefined {
  if (!quoteType) {
    return undefined;
  }
  const normalized = quoteType.toLowerCase();
  if (normalized.includes("equity") || normalized === "commonstock" || normalized === "stock") {
    return "equity";
  }
  if (normalized.includes("etf")) {
    return "etf";
  }
  if (normalized.includes("etn")) {
    return "etn";
  }
  if (normalized.includes("index")) {
    return "index";
  }
  return undefined;
}

function parsePortfolioIdParam(value: unknown): number {
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

function parsePortfolioIdStrict(value: unknown): number {
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

async function getPortfolioRecord(portfolioId: number) {
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

function decimalToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

async function deriveMarketPrice(symbol: string): Promise<number> {
  const quote = await getQuote(symbol);
  if (quote.price !== null && quote.price !== undefined) {
    return quote.price;
  }
  if (quote.previousClose !== null && quote.previousClose !== undefined) {
    return quote.previousClose;
  }
  throw new Error("Unable to derive price for trade");
}

async function buildPortfolioSnapshot(portfolioId: number = DEFAULT_PORTFOLIO_ID): Promise<PortfolioSnapshot> {
  const portfolioRecord = await getPortfolioRecord(portfolioId);
  const base = ensurePortfolio(portfolioRecord);
  const cashBalance = decimalToNumber(base.cashBalance);

  const positions = await prisma.position.findMany({
    where: { portfolioId }
  });

  const quotes = await Promise.all(positions.map((position: Position) => getQuote(position.symbol)));
  const emptyQuote: Parameters<typeof computePositionDto>[1] = { price: null };
  const positionDtos = positions.map((position: Position, index: number) =>
    computePositionDto(position, quotes[index] ?? emptyQuote)
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








