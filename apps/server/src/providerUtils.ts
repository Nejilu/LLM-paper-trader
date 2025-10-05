export function buildChatCompletionsUrl(apiBase: string): string {
  const trimmed = apiBase.trim();
  const withoutTrailingSlashes = trimmed.replace(/\/+$/, "");
  const withoutVersion = withoutTrailingSlashes.replace(/\/v1$/, "");

  return `${withoutVersion}/v1/chat/completions`;
}
