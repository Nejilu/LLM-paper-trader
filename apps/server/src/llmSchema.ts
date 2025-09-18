import { z } from "zod";

const arbitrageOrderSchema = z.object({
  symbol: z.string().min(1, "symbol is required").transform((value) => value.toUpperCase()),
  action: z.enum(["BUY", "SELL"], {
    invalid_type_error: "action must be BUY or SELL"
  }),
  quantity: z
    .number({ invalid_type_error: "quantity must be numeric" })
    .int("quantity must be an integer")
    .positive("quantity must be positive"),
  orderType: z.enum(["market", "limit"]).default("market"),
  limitPrice: z
    .number({ invalid_type_error: "limitPrice must be numeric" })
    .positive("limitPrice must be positive")
    .optional(),
  confidence: z
    .number({ invalid_type_error: "confidence must be numeric" })
    .min(0)
    .max(1)
    .optional(),
  rationale: z.string().optional()
});

export const arbitragePlanSchema = z.object({
  version: z.literal("1.0"),
  generatedAt: z.string(),
  arbitrages: z.array(arbitrageOrderSchema).max(25)
});

export type ArbitragePlan = z.infer<typeof arbitragePlanSchema>;
export type ArbitrageOrder = z.infer<typeof arbitrageOrderSchema>;

export const ARBITRAGE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://paper-trading.ai/schemas/arbitrage-plan.json",
  type: "object",
  additionalProperties: false,
  required: ["version", "generatedAt", "arbitrages"],
  properties: {
    version: {
      type: "string",
      const: "1.0"
    },
    generatedAt: {
      type: "string",
      description: "ISO-8601 timestamp of when the decisions were generated"
    },
    arbitrages: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "action", "quantity"],
        properties: {
          symbol: {
            type: "string",
            minLength: 1,
            description: "Ticker symbol to trade"
          },
          action: {
            type: "string",
            enum: ["BUY", "SELL"],
            description: "Trade direction"
          },
          quantity: {
            type: "integer",
            minimum: 1,
            description: "Number of shares to trade"
          },
          orderType: {
            type: "string",
            enum: ["market", "limit"],
            default: "market"
          },
          limitPrice: {
            type: "number",
            exclusiveMinimum: 0,
            description: "Required when orderType is limit"
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Optional confidence score from 0 to 1"
          },
          rationale: {
            type: "string",
            description: "Short explanation of the decision"
          }
        }
      }
    }
  }
} as const;

