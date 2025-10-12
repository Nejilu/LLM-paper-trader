import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildChatCompletionsUrl,
  buildChatCompletionsUrlWithoutVersion
} from "../src/providerUtils";
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

  it("keeps an explicit chat completions path", () => {
    expect(
      buildChatCompletionsUrl("https://proxy.local/v1/chat/completions")
    ).toBe("https://proxy.local/v1/chat/completions");
  });
});

describe("buildChatCompletionsUrlWithoutVersion", () => {
  it("drops the version segment when present", () => {
    expect(
      buildChatCompletionsUrlWithoutVersion("https://api.openai.com/v1")
    ).toBe("https://api.openai.com/chat/completions");
  });

  it("preserves an explicit chat completions path", () => {
    expect(
      buildChatCompletionsUrlWithoutVersion(
        "https://proxy.local/chat/completions"
      )
    ).toBe("https://proxy.local/chat/completions");
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

  it("retries without the versioned path when the provider returns 404", async () => {
    const responses = [
      {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => "not found"
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: "{\"trades\":[]}"
              }
            }
          ]
        }),
        text: async () => ""
      }
    ];

    let callIndex = 0;
    const fetchSpy = vi.fn().mockImplementation(() => {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex += 1;
      return Promise.resolve(response);
    });

    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await callProvider(
      {
        id: 10,
        name: "Perplexity",
        type: "openai-compatible",
        apiBase: "https://api.perplexity.ai",
        apiKey: "perplexity-key",
        model: "pplx-70b-online",
        temperature: null,
        maxTokens: null
      },
      {
        model: "pplx-70b-online",
        temperature: 0.1,
        max_tokens: null,
        messages: []
      }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.perplexity.ai/v1/chat/completions");
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://api.perplexity.ai/chat/completions");
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
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
    });
    expect(body).toHaveProperty("systemInstruction");
    expect(body).toHaveProperty("contents");
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
