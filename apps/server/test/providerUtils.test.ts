import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildChatCompletionsUrl } from "../src/providerUtils";
import { callProvider } from "../src/llmService";

const originalFetch = globalThis.fetch;

function mockFetch() {
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
  return fetchSpy;
}

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
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses the normalized chat completions endpoint", async () => {
    const fetchSpy = mockFetch();

    await callProvider(
      {
        id: 1,
        name: "Test Provider",
        type: "openai",
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

  it("appends /v1 when the provider base has no version suffix", async () => {
    const fetchSpy = mockFetch();

    await callProvider(
      {
        id: 1,
        name: "Test Provider",
        type: "openai",
        apiBase: "https://api.openai.com",
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
});
