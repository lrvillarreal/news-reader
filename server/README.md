<!-- server/README.md -->

# News Reader — API Proxy

Express backend for the News Reader application.

## Purpose

This server keeps the TheNewsApi token out of the browser.

The frontend sends requests to `/api/news/all`.

The backend then securely requests:

`https://api.thenewsapi.com/v1/news/all`

## Environment

Copy `.env.example` to `.env`.

Configure:

```dotenv
THENEWSAPI_TOKEN=your_real_api_token
PORT=5177
```

Never commit `.env` or the real token.

## Endpoints

### GET /api/health

Returns server status and whether a token is configured.

### GET /api/news/all

Supported query parameters:

- `page`: positive integer, default 1
- `categories`: one supported category
- `search`: keyword search

The backend always sends:

- `language=en`
- `limit=3`
- `page=<requested page>`
- Either `search` OR `categories`

Default category: `tech`.

## Error Handling

- 400: Invalid request parameters
- 401/403: Provider authentication failure
- 429: Provider rate limit
- 502: Upstream service failure
- 503: API token missing

## Security

The browser never receives the API token.

The backend never logs the upstream URL or token.

Only the official All News endpoint is used.

## Running the Server

From the root project directory:

```bash
npm run server:install
npm run dev
```

Backend: http://127.0.0.1:5177

Frontend: http://127.0.0.1:5176

## Technology

- Node.js
- Express
- dotenv
- nodemon
- TheNewsApi