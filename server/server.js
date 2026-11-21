// server/server.js

const express = require("express");
const https = require("node:https");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, ".env")
});

const app = express();

const PORT = Number(process.env.PORT) || 5177;

const API_URL = "https://api.thenewsapi.com/v1/news/all";

const PAGE_LIMIT = 3;
const MAX_PAGE = Math.ceil(20000 / PAGE_LIMIT);

const CATEGORIES = new Set([
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
]);

const ERROR_MESSAGES = {
  RATE_LIMIT: "Daily request limit reached. Please try again later.",
  AUTH: "TheNewsApi authentication failed. Check your API token.",
  UPSTREAM: "The news service is temporarily unavailable.",
  CONFIG: "TheNewsApi token is not configured on the server."
};

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}

function requestNews(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json"
        }
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;

          if (body.length > 2_000_000) {
            request.destroy(new Error("RESPONSE_TOO_LARGE"));
          }
        });

        response.on("end", () => {
          try {
            const payload = JSON.parse(body);

            resolve({
              status: response.statusCode || 502,
              payload
            });
          } catch {
            reject(new Error("INVALID_UPSTREAM_JSON"));
          }
        });

        response.on("error", reject);
      }
    );

    request.setTimeout(12000, () => {
      request.destroy(new Error("UPSTREAM_TIMEOUT"));
    });

    request.on("error", reject);
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    status: "ok",
    service: "news-reader-proxy",
    providerConfigured: Boolean(
      process.env.THENEWSAPI_TOKEN &&
      process.env.THENEWSAPI_TOKEN !==
        "YOUR_THENEWSAPI_TOKEN_HERE"
    )
  });
});

// All News endpoint
app.get("/api/news/all", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const token = process.env.THENEWSAPI_TOKEN;

  if (
    !token ||
    token === "YOUR_THENEWSAPI_TOKEN_HERE"
  ) {
    return sendError(
      res,
      503,
      "CONFIG",
      ERROR_MESSAGES.CONFIG
    );
  }

  const rawPage = req.query.page === undefined
    ? "1"
    : req.query.page;

  if (
    typeof rawPage !== "string" ||
    !/^\d+$/.test(rawPage)
  ) {
    return sendError(
      res,
      400,
      "INVALID_PAGE",
      "Page must be a positive integer."
    );
  }

  const page = Number(rawPage);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE
  ) {
    return sendError(
      res,
      400,
      "INVALID_PAGE",
      `Page must be between 1 and ${MAX_PAGE}.`
    );
  }

  if (
    req.query.search !== undefined &&
    typeof req.query.search !== "string"
  ) {
    return sendError(
      res,
      400,
      "INVALID_SEARCH",
      "Search must be a text value."
    );
  }

  const search = typeof req.query.search === "string"
    ? req.query.search.trim()
    : "";

  if (search.length > 200) {
    return sendError(
      res,
      400,
      "INVALID_SEARCH",
      "Search must contain 200 characters or fewer."
    );
  }

  const rawCategory = req.query.categories;

  if (
    !search &&
    rawCategory !== undefined &&
    typeof rawCategory !== "string"
  ) {
    return sendError(
      res,
      400,
      "INVALID_CATEGORY",
      "Category must be a single supported value."
    );
  }

  const category = typeof rawCategory === "string"
    ? rawCategory.trim()
    : "tech";

  if (!search && !CATEGORIES.has(category)) {
    return sendError(
      res,
      400,
      "INVALID_CATEGORY",
      "Unsupported news category."
    );
  }

  // The token exists ONLY on the server.
  // Never send this URL to the browser or logs.
  const upstreamUrl = new URL(API_URL);

  upstreamUrl.searchParams.set("api_token", token);
  upstreamUrl.searchParams.set("language", "en");
  upstreamUrl.searchParams.set(
    "limit",
    String(PAGE_LIMIT)
  );
  upstreamUrl.searchParams.set(
    "page",
    String(page)
  );

  if (search) {
    upstreamUrl.searchParams.set("search", search);
  } else {
    upstreamUrl.searchParams.set(
      "categories",
      category
    );
  }

  try {
    const { status, payload } =
      await requestNews(upstreamUrl);

    if (status === 429) {
      return sendError(
        res,
        429,
        "RATE_LIMIT",
        ERROR_MESSAGES.RATE_LIMIT
      );
    }

    if (status === 401 || status === 403) {
      return sendError(
        res,
        status,
        "AUTH",
        ERROR_MESSAGES.AUTH
      );
    }

    if (status < 200 || status >= 300) {
      return sendError(
        res,
        502,
        "UPSTREAM",
        ERROR_MESSAGES.UPSTREAM
      );
    }

    if (
      !payload ||
      !Array.isArray(payload.data) ||
      !payload.meta ||
      typeof payload.meta.found !== "number"
    ) {
      return sendError(
        res,
        502,
        "INVALID_RESPONSE",
        "The news provider returned an invalid response."
      );
    }

    // Return only the provider's article data and metadata.
    // The server-side API token is never included.
    return res.status(200).json({
      meta: payload.meta,
      data: payload.data
    });
  } catch {
    // Do not log URLs, tokens, or raw provider responses.
    console.error(
      "[news-proxy] Upstream request failed."
    );

    return sendError(
      res,
      502,
      "UPSTREAM",
      ERROR_MESSAGES.UPSTREAM
    );
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[news-proxy] Running on http://127.0.0.1:${PORT}`
  );
});