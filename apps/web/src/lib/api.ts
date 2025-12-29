type FetchInit = RequestInit & { next?: { revalidate?: number } };

export async function apiFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const url =
    path.startsWith("http") ? path : path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const message = await safeParseError(response);
    throw new Error(message ?? `API request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function safeParseError(response: Response) {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string") {
      return data.error;
    }
    return JSON.stringify(data);
  } catch (error) {
    return response.statusText;
  }
}
