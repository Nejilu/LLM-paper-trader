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
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    const reason = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to persist symbol resolution", reason);
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
    const quotes = (result.quotes ?? []) as YahooQuote[];
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

    const bestCandidate = ranked.length > 0 ? ranked[0].quote : quotes[0];
    if (!bestCandidate?.symbol) {
      return undefined;
    }

    return {
      yahooSymbol: bestCandidate.symbol,
      source: "yahoo"
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error(String(error));
    console.error("Yahoo Finance search failed", reason);
    return undefined;
  }
}

function buildYahooSearchTerm({ ticker, name, assetType }: ResolveYahooOptions) {
  if (assetType === "index") {
    return name ?? ticker ?? undefined;
  }
  return ticker ?? name ?? undefined;
}

type YahooQuote = {
  symbol?: string | null;
  exchange?: string | null;
  longname?: string | null;
  shortname?: string | null;
  typeDisp?: string | null;
  index?: string | null;
  name?: string | null;
  [key: string]: unknown;
};

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




