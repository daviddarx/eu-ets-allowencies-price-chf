# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npx netlify dev` — starts local server on port 8888 (serves static files + serverless functions)
- **Run tests:** `npm test` (runs `vitest run`)
- **Run single test:** `npx vitest run tests/parse-price.test.mjs`

## Architecture

A single-page app that displays the EU ETS CO2 allowance price in CHF, deployed on Netlify.

**Data flow:** Browser fetches `/api/price` → Netlify function scrapes EUR price from compensators.org, fetches EUR/CHF rate from frankfurter.app → returns JSON (CDN-cached 1 hour).

- `index.html` — Frontend (inline CSS/JS, no build step, dark-themed card)
- `netlify/functions/price.mjs` — Serverless function (Netlify Functions v2, route declared via `export const config`)
- `src/parse-price.mjs` — Pure function extracting the EUR price from scraped HTML (regex on `id="amount_display"` input)
- `tests/` — Vitest tests for the parse logic

No framework, no bundler, no API keys. ESM throughout (`"type": "module"` in package.json, `.mjs` extensions).
