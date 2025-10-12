function normalizeBase(apiBase: string) {
  return apiBase.trim().replace(/\/+$/, "");
}

function endsWithVersionSegment(value: string) {
  return /\/v\d[^/]*$/i.test(value);
}

function endsWithChatCompletions(value: string) {
  return /\/chat\/completions$/i.test(value);
}

export function buildChatCompletionsUrl(apiBase: string): string {
  const normalized = normalizeBase(apiBase);

  if (endsWithChatCompletions(normalized)) {
    return normalized;
  }

  if (endsWithVersionSegment(normalized)) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

export function buildChatCompletionsUrlWithoutVersion(apiBase: string): string {
  const normalized = normalizeBase(apiBase);

  if (endsWithChatCompletions(normalized)) {
    return normalized;
  }

  const withoutVersion = normalized.replace(/\/v\d[^/]*$/i, "");
  const base = withoutVersion === "" ? normalized : normalizeBase(withoutVersion);

  return `${base}/chat/completions`;
}
