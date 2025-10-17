import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildChatCompletionsUrl } from "../src/providerUtils";
import { callProvider } from "../src/llmService";
import { providerInputSchema, providerUpdateSchema } from "../src/llmRoutes";

const originalFetch = globalThis.fetch;

describe("buildChatCompletionsUrl", () => {
  it("appends the versioned path when base has no version", () => {
    expect(buildChatCompletionsUrl("https://api.openai.com")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
  });

  it("normalizes a base that already includes /v1", () => {
    expect(buildChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
  });

  it("handles a base that ends with /v1/", () => {
    expect(buildChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
  });
});

describe("callProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses the normalized chat completions endpoint for OpenAI-compatible providers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: "assistant",
              content: "{\"trades\":[]}" // minimal valid JSON string
            }
          }
        ]
      }),
      text: async () => ""
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await callProvider(
      {
        id: 1,
        name: "Test Provider",
        type: "openai-compatible",
        apiBase: "https://api.openai.com/v1",
        apiKey: "test-key",
        model: "gpt-4",
        temperature: null,
        maxTokens: null
      },
      {
        model: "gpt-4",
        temperature: 0,
        max_tokens: null,
        messages: []
      }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("builds a Gemini request with transformed payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "{\"trades\":[]}" }]
            }
          }
        ]
      }),
      text: async () => ""
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await callProvider(
      {
        id: 2,
        name: "Gemini",
        type: "google-gemini",
        apiBase: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "gemini-key",
        model: "gemini-pro",
        temperature: null,
        maxTokens: null
      },
      {
        model: "gemini-pro",
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "hello" }
        ]
      }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-goog-api-key": "gemini-key"
    });
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    expect(body).toMatchObject({
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      tools: [{ google_search: {} }]
    });
    expect(body).toHaveProperty("systemInstruction");
    expect(body).toHaveProperty("contents");
  });

  it("exposes Gemini grounding metadata when available", async () => {
    const groundingMetadata = {
      webSearchQueries: ["paper trading"],
      groundingChunks: [
        {
          id: "chunk-1",
          chunkContent: { text: "Chunk text" },
          web: { uri: "https://example.com", title: "Example" }
        }
      ],
      groundingSupports: [
        {
          groundingChunkIndices: [0],
          confidenceScores: [
            {
              probability: 0.42,
              type: "GROUNDING_SUPPORT_SCORE"
            }
          ]
        }
      ],
      searchEntryPoint: { renderedContent: "<p>Example</p>" }
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "{\"trades\":[]}" }]
            },
            groundingMetadata
          }
        ]
      }),
      text: async () => ""
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const result = await callProvider(
      {
        id: 2,
        name: "Gemini",
        type: "google-gemini",
        apiBase: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "gemini-key",
        model: "gemini-pro",
        temperature: null,
        maxTokens: null
      },
      {
        model: "gemini-pro",
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "hello" }
        ]
      }
    );

    expect(result.groundingMetadata).toEqual({
      webSearchQueries: ["paper trading"],
      groundingChunks: [groundingMetadata.groundingChunks[0]],
      groundingSupports: [groundingMetadata.groundingSupports[0]],
      searchEntryPoint: groundingMetadata.searchEntryPoint
    });
  });

  it("builds an Anthropic request with system prompt and headers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "{\"trades\":[]}" // minimal valid JSON string
          }
        ]
      }),
      text: async () => ""
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await callProvider(
      {
        id: 3,
        name: "Claude",
        type: "anthropic",
        apiBase: "https://api.anthropic.com",
        apiKey: "anthropic-key",
        model: "claude-3-opus-20240229",
        temperature: null,
        maxTokens: null
      },
      {
        model: "claude-3-opus-20240229",
        temperature: 0.2,
        max_tokens: null,
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "hello" }
        ]
      }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": "anthropic-key"
    });
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "claude-3-opus-20240229",
      temperature: 0.2,
      max_tokens: 1024,
      system: "system"
    });
    expect(body).toHaveProperty("messages");
  });
});

describe("LLM provider schemas", () => {
  it("accepts the Gemini provider type on creation", () => {
    const result = providerInputSchema.safeParse({
      name: "Gemini",
      type: "google-gemini",
      apiBase: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "key",
      model: "gemini-pro"
    });
    expect(result.success).toBe(true);
  });

  it("accepts the Anthropic provider type on update", () => {
    const result = providerUpdateSchema.safeParse({
      type: "anthropic"
    });
    expect(result.success).toBe(true);
  });
});
