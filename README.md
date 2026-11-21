# News Reader

A responsive React news reader for exploring current stories by topic or keyword. The application presents one article at a time, supports pagination and prefetching, and keeps saved favorites in browser local storage.

## Features

- Browse news across 10 categories
- Search stories by keyword
- Navigate articles with a first, previous, and next pager
- Save favorites locally in the browser
- Prefetch adjacent result pages for smoother navigation
- Retry and loading states for API failures
- Secure backend proxy for the TheNewsApi API token
- Responsive editorial-style interface

## Technology

- React 18
- TypeScript
- Vite
- CSS
- Node.js
- Express
- TheNewsApi

## Project Structure

```text
news-reader/
├── package.json              # Workspace-level development commands
├── scripts/
│   └── generate-placeholder.cjs  # Generates the fallback article image
├── server/
│   ├── server.js             # Express API proxy
│   ├── package.json
│   └── .env.example
└── web/
    ├── src/
    │   ├── App.tsx           # Application state and navigation
    │   ├── main.tsx          # React entry point
    │   ├── styles.css
    │   ├── components/
    │   │   └── HeadlinesList.tsx
    │   └── lib/
    │       └── newsapi.ts    # API types and frontend client
    ├── public/              # Static assets
    └── vite.config.ts       # Vite server and API proxy configuration
```

## How It Works

The Vite frontend requests `/api/news/all` from the local development server. Vite forwards those requests to the Express proxy on port `5177`. The proxy adds the TheNewsApi token server-side, requests English news articles, validates query parameters, and returns only article data and metadata to the browser.

Favorites are stored under `news-reader:favorites:v1` in `localStorage`; no account or backend storage is required.

## Prerequisites

- Node.js and npm
- A TheNewsApi API token

## Setup

1. Clone the repository:

```bash
git clone https://github.com/lrvillarreal/news-reader.git
cd news-reader
```

2. Install dependencies for the root project, API server, and frontend:

```bash
npm run server:install
```

3. Create the server environment file:

```bash
cp server/.env.example server/.env
```

4. Add your token to `server/.env`:

```dotenv
THENEWSAPI_TOKEN=your_real_api_token
PORT=5177
```

Never commit `server/.env` or expose the API token in frontend code.

## Run Locally

Start both the Express proxy and Vite frontend:

```bash
npm run dev
```

Open:

- Frontend: http://127.0.0.1:5176
- API health check: http://127.0.0.1:5177/api/health

You can also run each application separately:

```bash
npm run server:dev
npm run web:dev
```

## Build

Create a production build of the frontend:

```bash
npm run build
```

The generated static files are written to `web/dist`. The Express server must remain available to handle `/api` requests in a deployed environment.

## API Proxy

### `GET /api/health`

Returns proxy status and whether a provider token is configured.

### `GET /api/news/all`

Supported parameters:

- `page` — positive page number
- `categories` — a supported category
- `search` — keyword search of up to 200 characters

The proxy requests three English articles per page and supports the following categories:

`tech`, `general`, `science`, `sports`, `business`, `health`, `entertainment`, `politics`, `food`, `travel`

## License

No license has been specified for this project.
