# EU ETS Allowance Price in CHF — Design Spec

## Overview

A simple standalone web app deployed on Netlify that displays the current EU ETS (Emissions Trading System) CO2 allowance price converted from EUR to CHF. The price is scraped from compensators.org and the exchange rate is fetched from a free API.

## Architecture

```
Browser (static HTML/CSS/JS)
    │
    │  fetch("/api/price")
    ▼
Netlify Function (/netlify/functions/price.js)
    │
    ├── GET compensators.org iframe URL → parse amount_display value (EUR)
    ├── GET exchange rate API (frankfurter.app) → EUR/CHF rate
    │
    └── Return JSON + Cache-Control: public, s-maxage=3600
```

### Data Flow

1. User visits the page
2. Frontend JS calls `/api/price`
3. Netlify CDN serves cached response if available (max 1 hour), otherwise invokes the function
4. Function scrapes the EUR price, fetches the exchange rate, computes CHF price, returns JSON
5. Frontend renders the result in a styled card

## Data Sources

### EU ETS Price (EUR)

- **Source URL:** `https://www.compensators.org/wp-content/themes/compensators/DonationFirst_int.php?lang=en_GB`
- **Field:** Input element with `id="amount_display"`, value is the price in EUR for 1 ton of CO2
- **Extraction:** Regex on the HTML response to find the input with `id="amount_display"` and extract its `value` attribute. The implementation should handle attribute ordering variations (e.g., `value` before or after `id`).
- **Note:** This is the iframe embedded on `https://www.compensators.org/en/compensate-2/`. Fetching the PHP URL directly returns the full form HTML without needing to render JavaScript.

### EUR/CHF Exchange Rate

- **Source:** `https://api.frankfurter.app/latest?from=EUR&to=CHF`
- **Auth:** None required (free, open API)
- **Rate source:** European Central Bank, updated daily on business days
- **Response format:** `{ "rates": { "CHF": 0.9457 } }`

## Serverless Function

**Path:** `netlify/functions/price.js`

**Response (success — 200):**
```json
{
  "priceEur": 87.16,
  "priceChf": 82.43,
  "exchangeRate": 0.9457,
  "fetchedAt": "2026-06-08T14:30:00Z"
}
```

**Response (error — 502):**
```json
{
  "error": "Failed to fetch price data"
}
```

**Caching:** `Cache-Control: public, s-maxage=3600` — Netlify CDN caches the response for 1 hour. Visitors within that window get instant responses. After expiry, the next request triggers a fresh fetch.

**Error handling:** If either the scrape or the exchange rate fetch fails, return 502 with a JSON error message.

## Frontend

**File:** `index.html` (single file, inline CSS and JS, no build step)

**Visual design:**
- Dark theme, modern aesthetic
- Centered card layout
- CHF price displayed prominently in large text
- EUR price shown smaller underneath as reference
- EUR/CHF exchange rate displayed
- "Last updated" line with date and time (formatted for user's locale)

**States:**
- **Loading:** Subtle loading indicator while `/api/price` responds
- **Success:** Card with all data populated
- **Error:** "Price unavailable, try again later" message

## Project Structure

```
/
├── index.html              # Frontend — HTML/CSS/JS all inline
├── netlify/
│   └── functions/
│       └── price.js        # Serverless function
├── netlify.toml            # Functions config
└── package.json            # Minimal, deployment metadata
```

## netlify.toml

Functions configuration (routing is handled by the function's `export const config = { path: "/api/price" }` — Netlify Functions v2):
```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

## Constraints and Decisions

- **No database:** Only the current price is shown, no historical data stored
- **No build step:** Plain HTML/CSS/JS, no framework or bundler
- **No API keys:** Both data sources are free and keyless
- **Caching over scheduling:** CDN-level caching (1 hour) avoids hammering source sites without needing scheduled functions or persistent storage
- **Scraping risk:** If compensators.org changes their form HTML structure, the regex extraction will break. This is accepted as a low-probability risk for a simple app.
