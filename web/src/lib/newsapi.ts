// web/src/lib/newsapi.ts

export const CATEGORIES = [
  "tech",
  "general",
  "science",
  "sports",
  "business",
  "health",
  "entertainment",
  "politics",
  "food",
  "travel"
] as const;

export type NewsCategory = typeof CATEGORIES[number];

export interface NewsArticle {
  uuid: string;
  title: string;
  description: string | null;
  snippet: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  source: string;
  categories: string[];
}

export interface NewsMeta {
  found: number;
  returned: number;
  limit: number;
  page: number;
}

export interface NewsPage {
  meta: NewsMeta;
  data: NewsArticle[];
}

export interface NewsQuery {
  page: number;
  category: NewsCategory;
  search: string;
}

export const PAGE_SIZE = 3;

export const MAX_RESULTS = 20000;

export class NewsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "NewsApiError";
    this.status = status;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof NewsApiError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.name === "AbortError"
  ) {
    return "The request was cancelled.";
  }

  return "Unable to load news. Check your connection and try again.";
}

export function safeExternalUrl(
  input: string | null | undefined
): string | null {
  if (!input) return null;

  try {
    const url = new URL(input);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function totalPagesFor(
  found: number
): number {
  const accessible = Math.min(
    Math.max(0, found),
    MAX_RESULTS
  );

  return Math.max(
    1,
    Math.ceil(accessible / PAGE_SIZE)
  );
}

function isNewsPage(value: unknown): value is NewsPage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<NewsPage>;

  return (
    Array.isArray(result.data) &&
    !!result.meta &&
    typeof result.meta.found === "number" &&
    typeof result.meta.page === "number"
  );
}

export async function fetchNewsPage(
  query: NewsQuery,
  signal?: AbortSignal
): Promise<NewsPage> {
  const params = new URLSearchParams();

  params.set("page", String(query.page));

  const search = query.search.trim();

  if (search) {
    params.set("search", search);
  } else {
    params.set("categories", query.category);
  }

  const endpoint = `/api/news/all?${params.toString()}`;

  // Debugging: this URL never contains the API token.
  console.info(
    "[news-reader] Proxied request:",
    endpoint
  );

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    signal
  });

  const payload: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    if (response.status === 429) {
      throw new NewsApiError(
        "Daily request limit reached. Please try again later.",
        429
      );
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw new NewsApiError(
        "TheNewsApi authentication failed. Check your API token.",
        response.status
      );
    }

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload
    ) {
      const body = payload as {
        error?: {
          message?: string;
        };
      };

      if (typeof body.error?.message === "string") {
        throw new NewsApiError(
          body.error.message,
          response.status
        );
      }
    }

    throw new NewsApiError(
      "The news service could not complete your request.",
      response.status
    );
  }

  if (!isNewsPage(payload)) {
    throw new NewsApiError(
      "The news service returned unexpected data.",
      502
    );
  }

  return payload;
}