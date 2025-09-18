import { AssetClass, SearchResultItem } from "./types";

const OPENFIGI_ENDPOINT = "https://api.openfigi.com/v3/search";
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface OpenFigiSecurity {
  name: string;
  ticker?: string;
  marketSector?: string;
  securityType?: string;
  securityType2?: string;
  micCode?: string;
  exchCode?: string;
}

interface OpenFigiResponse {
  data?: OpenFigiSecurity[];
  next?: string;
}

type AssetClassFilter = AssetClass[] | undefined;

class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  async acquire() {
    for (;;) {
      const now = Date.now();
      while (this.timestamps.length && now - this.timestamps[0] >= this.windowMs) {
        this.timestamps.shift();
      }
      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = this.windowMs - (now - this.timestamps[0]) + 5;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

const limiter = new RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);

function mapAssetType(security: OpenFigiSecurity): AssetClass | undefined {
  const descriptors = [security.securityType2, security.securityType, security.marketSector]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  if (descriptors.some((value) => value.includes("index"))) {
    return "index";
  }
  if (descriptors.some((value) => value.includes("etn"))) {
    return "etn";
  }
  if (descriptors.some((value) => value.includes("etf") || value.includes("fund"))) {
    return "etf";
  }
  if (descriptors.some((value) => value.includes("equity") || value.includes("common stock"))) {
    return "equity";
  }

  return undefined;
}

function matchesRequestedAssetType(assetType: AssetClass | undefined, filter: AssetClassFilter) {
  if (!filter || filter.length === 0) {
    return true;
  }
  if (!assetType) {
    return false;
  }
  return filter.includes(assetType);
}

export interface OpenFigiSearchParams {
  query: string;
  types?: AssetClass[];
  limit?: number;
}

export class OpenFigiClient {
  constructor(private readonly apiKey?: string) {}

  async search({ query, types, limit = 10 }: OpenFigiSearchParams): Promise<SearchResultItem[]> {
    if (!query.trim()) {
      return [];
    }

    const results: SearchResultItem[] = [];
    let nextToken: string | undefined;

    while (results.length < limit) {
      const response = await this.fetchPage({ query, next: nextToken });
      const data = response?.data ?? [];

      for (const security of data) {
        const assetType = mapAssetType(security);
        if (!matchesRequestedAssetType(assetType, types)) {
          continue;
        }
        if (!security.ticker) {
          continue;
        }
        results.push({
          name: security.name ?? security.ticker,
          ticker: security.ticker,
          mic: security.micCode,
          exchangeCode: security.exchCode,
          assetType: assetType ?? "equity",
          source: "openfigi"
        });
        if (results.length >= limit) {
          break;
        }
      }

      if (!response?.next || results.length >= limit) {
        break;
      }
      nextToken = response.next;
    }

    return results.slice(0, limit);
  }

  private async fetchPage({
    query,
    next
  }: {
    query: string;
    next?: string;
  }): Promise<OpenFigiResponse | undefined> {
    try {
      await limiter.acquire();
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["X-OPENFIGI-APIKEY"] = this.apiKey;
      }
      const response = await fetch(OPENFIGI_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          next,
          options: {
            securityType: ["Common Stock", "Exchange Traded Fund", "Exchange Traded Note", "Index"],
            includeUnlistedEquities: false
          }
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("OpenFIGI request failed", response.status, text);
        return undefined;
      }

      const payload = (await response.json()) as OpenFigiResponse;
      return payload;
    } catch (error) {
      console.error("OpenFIGI request error", error);
      return undefined;
    }
  }
}

