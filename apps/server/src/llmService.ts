import { prisma } from "@paper-trading/db";
import type { HistoryCandle } from "./types";
import { TradeInput } from "./portfolio";
import {
  buildPortfolioSnapshot,
  deriveMarketPrice,
  executeTradeInputs,
  getPortfolioRecord
} from "./portfolioService";
import { ARBITRAGE_JSON_SCHEMA, ArbitrageOrder, ArbitragePlan, arbitragePlanSchema } from "./llmSchema";
import { getHistory, getQuote } from "./yahoo";

const BASE_SYSTEM_PROMPT = `You are an automated portfolio manager executing paper trades for backtesting purposes. Follow the risk constraints embedded in the user's instructions. You MUST reply with a single JSON document that validates against the provided JSON Schema. Do not include markdown fences or any commentary.`;

const DEFAULT_USER_TEMPLATE = `Current UTC time: {{CURRENT_DATETIME}}
Portfolio snapshot (positions with market values):
{{PORTFOLIO_JSON}}

Latest market quotes for held symbols:
{{QUOTES_JSON}}

Recent trades (latest first):
{{RECENT_TRADES_JSON}}

Recent daily candles per symbol (latest 60 observations):
{{HISTORIES_JSON}}

JSON Schema definitions for the response:
{{JSON_SCHEMA}}

Using the schema above, decide on concrete arbitrage trades that comply with the risk limits from your additional instructions.`;

interface RawContext {
  portfolio: Awaited<ReturnType<typeof buildPortfolioSnapshot>>;
  quotes: Record<string, Awaited<ReturnType<typeof getQuote>>>;
  histories: Record<string, HistoryCandle[]>;
  recentTrades: Array<{
    id: number;
    symbol: string;
    side: string;
    qty: number;
    price: number;
    ts: string;
  }>;
}

interface ExecutionContext {
  baseCurrency: string;
  portfolioJson: string;
  quotesJson: string;
  historiesJson: string;
  tradesJson: string;
  schemaJson: string;
  raw: RawContext;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface LlmApiResponse {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role: "assistant";
      content: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface LlmRunOptions {
  portfolioId: number;
  prompt: {
    id?: number;
    systemPrompt?: string;
    userTemplate?: string;
  } | null;
  provider: {
    id: number;
    name: string;
    type: string;
    apiBase: string;
    apiKey: string | null;
    model: string;
    temperature?: number | null;
    maxTokens?: number | null;
  };
  overrides?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
  dryRun?: boolean;
}

export interface LlmRunResult {
  plan: ArbitragePlan;
  rawResponse: string;
  assistantMessage: string;
  trades: TradeInput[];
  executed: boolean;
  snapshot?: Awaited<ReturnType<typeof buildPortfolioSnapshot>>;
  systemPrompt: string;
  userPrompt: string;
  messages: ChatMessage[];
  context: ExecutionContext;
}

export async function runLlmPlan(options: LlmRunOptions): Promise<LlmRunResult> {
  const { portfolioId, prompt, provider, overrides, dryRun = false } = options;
  await getPortfolioRecord(portfolioId);

  const context = await buildExecutionContext(portfolioId);
  const userTemplate = (prompt?.userTemplate?.trim()?.length ? prompt.userTemplate : undefined) ?? DEFAULT_USER_TEMPLATE;
  const systemPrompt = buildSystemPrompt(prompt?.systemPrompt);
  const userPrompt = renderTemplate(userTemplate, context);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const llmPayload = {
    model: overrides?.model ?? provider.model,
    temperature: overrides?.temperature ?? provider.temperature ?? 0,
    max_tokens: overrides?.maxTokens ?? provider.maxTokens ?? undefined,
    messages,
    response_format: { type: "json_object" }
  } as const;

  const { content, rawResponse } = await callProvider(provider, llmPayload);
  const plan = parseArbitragePlan(content);
  const trades = await buildTradesFromPlan(plan, context);

  if (dryRun || trades.length === 0) {
    return {
      plan,
      rawResponse,
      assistantMessage: content,
      trades,
      executed: false,
      systemPrompt,
      userPrompt,
      messages,
      context
    };
  }

  await executeTradeInputs(trades, portfolioId);
  const snapshot = await buildPortfolioSnapshot(portfolioId);

  return {
    plan,
    rawResponse,
    assistantMessage: content,
    trades,
    executed: true,
    snapshot,
    systemPrompt,
    userPrompt,
    messages,
    context
  };
}

function buildSystemPrompt(additional?: string | null) {
  const extras = additional?.trim();
  if (extras) {
    return `${BASE_SYSTEM_PROMPT}\n\n${extras}`;
  }
  return BASE_SYSTEM_PROMPT;
}

function renderTemplate(template: string, context: ExecutionContext) {
  return template
    .replaceAll("{{PORTFOLIO_JSON}}", context.portfolioJson)
    .replaceAll("{{QUOTES_JSON}}", context.quotesJson)
    .replaceAll("{{HISTORIES_JSON}}", context.historiesJson)
    .replaceAll("{{RECENT_TRADES_JSON}}", context.tradesJson)
    .replaceAll("{{JSON_SCHEMA}}", context.schemaJson)
    .replaceAll("{{CURRENT_DATETIME}}", new Date().toISOString())
    .replaceAll("{{BASE_CURRENCY}}", context.baseCurrency);
}

async function buildExecutionContext(portfolioId: number): Promise<ExecutionContext> {
  const snapshot = await buildPortfolioSnapshot(portfolioId);
  const symbols = Array.from(new Set(snapshot.positions.map((position) => position.symbol)));

  const quoteEntries = await Promise.all(
    symbols.map(async (symbol) => {
      const quote = await getQuote(symbol);
      return [symbol, quote] as const;
    })
  );

  const historyEntries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const candles = await getHistory(symbol, "3mo", "1d");
        return [symbol, candles.slice(-60)] as const;
      } catch (error) {
        console.error(`Failed to load history for ${symbol}`, error);
        return [symbol, []] as const;
      }
    })
  );

  const trades = await prisma.trade.findMany({
    where: { portfolioId },
    orderBy: { ts: "desc" },
    take: 20
  });

  const raw: RawContext = {
    portfolio: snapshot,
    quotes: Object.fromEntries(quoteEntries),
    histories: Object.fromEntries(historyEntries),
    recentTrades: trades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      qty: trade.qty.toNumber(),
      price: trade.price.toNumber(),
      ts: trade.ts.toISOString()
    }))
  };

  return {
    baseCurrency: snapshot.baseCurrency,
    portfolioJson: JSON.stringify(raw.portfolio, null, 2),
    quotesJson: JSON.stringify(raw.quotes, null, 2),
    historiesJson: JSON.stringify(raw.histories, null, 2),
    tradesJson: JSON.stringify(raw.recentTrades, null, 2),
    schemaJson: JSON.stringify(ARBITRAGE_JSON_SCHEMA, null, 2),
    raw
  };
}

async function callProvider(
  provider: LlmRunOptions["provider"],
  payload: {
    model: string;
    temperature?: number | null;
    max_tokens?: number | null;
    messages: ChatMessage[];
    response_format?: { type: string };
  }
) {
  const endpoint = provider.apiBase.replace(/\/+$/, "");
  const baseBody: Record<string, unknown> = {
    model: payload.model,
    messages: payload.messages,
    temperature: payload.temperature ?? 0
  };
  if (payload.max_tokens) {
    baseBody.max_tokens = payload.max_tokens;
  }
  if (payload.response_format) {
    baseBody.response_format = payload.response_format;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }

  let response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(baseBody)
  });

  if (!response.ok && payload.response_format) {
    const fallbackBody = { ...baseBody };
    delete fallbackBody.response_format;
    response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(fallbackBody)
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM provider request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as LlmApiResponse;
  if (data.error?.message) {
    throw new Error(`LLM provider error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM provider returned no content");
  }

  return { content, rawResponse: JSON.stringify(data) };
}

function parseArbitragePlan(content: string): ArbitragePlan {
  const normalized = content.trim();
  const jsonPayload = extractJson(normalized);
  const parsed = JSON.parse(jsonPayload);
  const validation = arbitragePlanSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(`LLM response failed schema validation: ${validation.error.message}`);
  }
  return validation.data;
}

function extractJson(content: string): string {
  if (content.startsWith("```")) {
    const withoutFence = content.replace(/```json?\s*|```/gi, "");
    return withoutFence.trim();
  }

  try {
    JSON.parse(content);
    return content;
  } catch (error) {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = content.slice(start, end + 1);
      JSON.parse(candidate);
      return candidate;
    }
  }

  throw new Error("Unable to extract JSON payload from LLM response");
}

async function buildTradesFromPlan(plan: ArbitragePlan, context: ExecutionContext) {
  const trades: TradeInput[] = [];
  for (const order of plan.arbitrages) {
    const normalized = normalizeOrder(order);
    const price = await determinePriceForOrder(normalized, context);
    trades.push({
      symbol: normalized.symbol,
      side: normalized.action,
      qty: normalized.quantity,
      price
    });
  }
  return trades;
}

function normalizeOrder(order: ArbitrageOrder) {
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) {
    throw new Error(`Invalid quantity for ${order.symbol}`);
  }
  if (order.orderType === "limit" && (order.limitPrice === undefined || order.limitPrice === null)) {
    throw new Error(`Order for ${order.symbol} is limit but has no limitPrice`);
  }
  return order;
}

async function determinePriceForOrder(order: ArbitrageOrder, context: ExecutionContext) {
  if (order.orderType === "limit" && order.limitPrice) {
    return order.limitPrice;
  }

  const quote = context.raw.quotes[order.symbol] as { price?: number | null } | undefined;
  if (quote && typeof quote.price === "number") {
    return quote.price;
  }

  return deriveMarketPrice(order.symbol);
}










