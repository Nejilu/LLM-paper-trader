import yahooFinance from "yahoo-finance2";
import { prisma, Prisma } from "@paper-trading/db";
import { applyYahooSuffix, getYahooSuffixForMic } from "@paper-trading/server-shared";
import { AssetClass } from "./types";

interface ResolveYahooOptions {
  userQuery: string;
  ticker?: string;
  name?: string;
  mic?: string | null;
  assetType?: AssetClass;
}

interface ResolvedSymbol {
  yahooSymbol: string;
  source: "openfigi" | "yahoo";
}

const INDEX_PREFIX = "^";

export async function resolveYahooSymbol(options: ResolveYahooOptions): Promise<ResolvedSymbol | undefined> {
  const { userQuery, ticker } = options;
  const normalizedMic = options.mic ? options.mic.toUpperCase() : null;
  const keyBase = ticker ?? options.name ?? userQuery;
  if (!keyBase) {
    return undefined;
  }

  const resolutionKey = buildResolutionKey(userQuery, keyBase, normalizedMic ?? undefined);

  const existing = await prisma.symbolResolution.findFirst({
    where: {
      query: resolutionKey,
      mic: normalizedMic
    }
  });

  if (existing) {
    return { yahooSymbol: existing.resultSymbol, source: "openfigi" };
  }

  const mappedSymbol = ticker ? applyYahooSuffix(ticker, normalizedMic) : undefined;
  if (mappedSymbol) {
    await persistResolution(resolutionKey, mappedSymbol, normalizedMic);
    return { yahooSymbol: mappedSymbol, source: "openfigi" };
  }

  const yahooMatch = await searchYahoo({ ...options, mic: normalizedMic });
  if (yahooMatch) {
    await persistResolution(resolutionKey, yahooMatch.yahooSymbol, normalizedMic);
    return yahooMatch;
  }

  return undefined;
}

async function persistResolution(query: string, symbol: string, mic?: string | null) {
  const normalizedMic = mic ? mic.toUpperCase() : null;
  try {
    await prisma.symbolResolution.create({
      data: {
        query,
        resultSymbol: symbol,
        mic: normalizedMic
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    console.error("Failed to persist symbol resolution", error);
  }
}

function buildResolutionKey(query: string, identifier: string, mic?: string): string {
  return [query.trim().toLowerCase(), identifier.trim().toUpperCase(), mic ? mic.toUpperCase() : ""].filter(Boolean).join("|");
}

async function searchYahoo(options: ResolveYahooOptions): Promise<ResolvedSymbol | undefined> {
  const searchTerm = buildYahooSearchTerm(options);
  if (!searchTerm) {
    return undefined;
  }

  try {
    const result = await yahooFinance.search(searchTerm, { quotesCount: 8, newsCount: 0 });
    const quotes = result.quotes ?? [];
    if (!quotes.length) {
      return undefined;
    }

    const ranked = quotes
      .map((quote) => ({
        quote,
        score: scoreQuote(quote, options)
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const best = (ranked[0] ?? quotes[0])?.quote;
    if (!best?.symbol) {
      return undefined;
    }

    return {
      yahooSymbol: best.symbol,
      source: "yahoo"
    };
  } catch (error) {
    console.error("Yahoo Finance search failed", error);
    return undefined;
  }
}

function buildYahooSearchTerm({ ticker, name, assetType }: ResolveYahooOptions) {
  if (assetType === "index") {
    return name ?? ticker ?? undefined;
  }
  return ticker ?? name ?? undefined;
}

type YahooQuote = Awaited<ReturnType<typeof yahooFinance.search>> extends { quotes: infer Q }
  ? (Q extends (infer U)[] ? U : never)
  : never;

function scoreQuote(quote: YahooQuote, { ticker, mic, assetType, name }: ResolveYahooOptions): number {
  let score = 0;
  const symbol = quote.symbol ?? "";

  if (!symbol) {
    return score;
  }

  const normalizedMic = mic ? mic.toUpperCase() : undefined;
  const expectedSuffix = getYahooSuffixForMic(normalizedMic);
  if (expectedSuffix !== undefined) {
    if (expectedSuffix === "" && !symbol.includes(".")) {
      score += 4;
    } else if (symbol.toUpperCase().endsWith(expectedSuffix.toUpperCase())) {
      score += 5;
    }
  }

  if (ticker && symbol.split(".")[0].toUpperCase() === ticker.toUpperCase()) {
    score += 5;
  }

  if (assetType === "index" && symbol.startsWith(INDEX_PREFIX)) {
    score += 6;
  }

  if (normalizedMic && quote.exchange?.toUpperCase() === normalizedMic) {
    score += 2;
  }

  if (name && quote.longname?.toLowerCase().includes(name.toLowerCase())) {
    score += 2;
  }

  return score;
}
