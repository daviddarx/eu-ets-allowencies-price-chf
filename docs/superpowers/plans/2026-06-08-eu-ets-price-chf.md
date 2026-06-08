# EU ETS Price in CHF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Netlify-deployed web app that displays the current EU ETS CO2 allowance price in CHF, scraped from compensators.org and converted using a live exchange rate.

**Architecture:** A single Netlify serverless function scrapes the EUR price and fetches the EUR/CHF rate, returning JSON cached at the CDN for 1 hour. A static HTML page calls this function on load and renders the result in a dark-themed card.

**Tech Stack:** Plain HTML/CSS/JS (no framework), Node.js serverless function, Vitest for tests.

---

## File Structure

```
/
├── index.html                    # Frontend — dark themed card UI, inline CSS/JS
├── netlify/
│   └── functions/
│       └── price.mjs             # Serverless function — scrape + convert + return JSON
├── src/
│   └── parse-price.mjs           # Pure function: extract EUR price from HTML string
├── tests/
│   └── parse-price.test.mjs      # Tests for the parsing logic
├── netlify.toml                  # Redirect /api/price → function
└── package.json                  # Scripts, dev dependencies (vitest)
```

- `src/parse-price.mjs` — Extracted pure function so the HTML-parsing logic is testable without mocking HTTP calls.
- `netlify/functions/price.mjs` — Orchestrates I/O (two fetches) and uses the parse function. Thin glue, not unit-tested (tested manually via `netlify dev`).
- `index.html` — Single file with inline CSS and JS. Calls `/api/price`, renders the card.

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `netlify.toml`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "eu-ets-price-chf",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "netlify dev"
  },
  "devDependencies": {
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create netlify.toml**

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

The function itself declares its route via `export const config = { path: "/api/price" }` (Netlify Functions v2), so no redirect rule is needed.

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json netlify.toml
git commit -m "chore: project setup with vitest and netlify config"
```

---

### Task 2: Price Parsing Logic (TDD)

**Files:**
- Create: `src/parse-price.mjs`
- Create: `tests/parse-price.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/parse-price.test.mjs`:

```js
import { describe, it, expect } from "vitest"
import { parseEurPrice } from "../src/parse-price.mjs"

describe("parseEurPrice", () => {
  it("extracts price from amount_display input with id before value", () => {
    const html = `
      <input id="amount_display" type="text" value="87.16">
    `
    expect(parseEurPrice(html)).toBe(87.16)
  })

  it("extracts price from amount_display input with value before id", () => {
    const html = `
      <input value="92.50" type="text" id="amount_display">
    `
    expect(parseEurPrice(html)).toBe(92.5)
  })

  it("extracts price when surrounded by other inputs", () => {
    const html = `
      <input id="other_field" value="999">
      <input id="amount_display" type="text" value="45.00">
      <input id="another_field" value="123">
    `
    expect(parseEurPrice(html)).toBe(45.0)
  })

  it("throws when amount_display is not found", () => {
    const html = `<input id="something_else" value="100">`
    expect(() => parseEurPrice(html)).toThrow("amount_display not found")
  })

  it("throws when value is not a valid number", () => {
    const html = `<input id="amount_display" value="abc">`
    expect(() => parseEurPrice(html)).toThrow("Invalid price value")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run`
Expected: All 5 tests FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement parseEurPrice**

Create `src/parse-price.mjs`:

```js
export function parseEurPrice(html) {
  const inputPattern = /<input[^>]*id="amount_display"[^>]*>/i
  const match = html.match(inputPattern)

  if (!match) {
    throw new Error("amount_display not found in HTML")
  }

  const valueMatch = match[0].match(/value="([^"]*)"/)
  if (!valueMatch) {
    throw new Error("amount_display not found in HTML")
  }

  const price = parseFloat(valueMatch[1])
  if (isNaN(price)) {
    throw new Error("Invalid price value")
  }

  return price
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parse-price.mjs tests/parse-price.test.mjs
git commit -m "feat: add EUR price parser with tests"
```

---

### Task 3: Serverless Function

**Files:**
- Create: `netlify/functions/price.mjs`

- [ ] **Step 1: Create the function**

Create `netlify/functions/price.mjs`:

```js
import { parseEurPrice } from "../../src/parse-price.mjs"

const COMPENSATORS_URL =
  "https://www.compensators.org/wp-content/themes/compensators/DonationFirst_int.php?lang=en_GB"
const EXCHANGE_RATE_URL = "https://api.frankfurter.app/latest?from=EUR&to=CHF"

export default async function handler(req) {
  try {
    const [htmlResponse, rateResponse] = await Promise.all([
      fetch(COMPENSATORS_URL),
      fetch(EXCHANGE_RATE_URL),
    ])

    if (!htmlResponse.ok) {
      throw new Error(`Compensators responded with ${htmlResponse.status}`)
    }
    if (!rateResponse.ok) {
      throw new Error(`Exchange rate API responded with ${rateResponse.status}`)
    }

    const html = await htmlResponse.text()
    const priceEur = parseEurPrice(html)

    const rateData = await rateResponse.json()
    const exchangeRate = rateData.rates.CHF

    const priceChf = Math.round(priceEur * exchangeRate * 100) / 100

    return new Response(
      JSON.stringify({
        priceEur,
        priceChf,
        exchangeRate,
        fetchedAt: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    })
  }
}

export const config = {
  path: "/api/price",
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/price.mjs
git commit -m "feat: add serverless function to fetch and convert EU ETS price"
```

---

### Task 4: Frontend

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

Create `index.html` with a dark-themed card layout. The page should include:

**HTML structure:**
- A centered card container
- Large CHF price display (main number)
- Smaller EUR price underneath
- Exchange rate line
- "Last updated" timestamp
- Loading spinner (shown initially)
- Error message (hidden initially)

**CSS (inline in `<style>`):**
- Dark background: `#0a0a0a` or similar near-black
- Card background: `#1a1a2e` or similar dark blue-gray
- Card with rounded corners, subtle border or shadow
- Primary text (CHF price): white, large (3-4rem)
- Secondary text (EUR, rate, timestamp): muted gray (`#94a3b8`)
- Subtle accent color for labels (e.g., `#38bdf8` light blue)
- Responsive: card should look good on mobile
- Font: system font stack or a clean sans-serif

**JS (inline in `<script>`):**
- On `DOMContentLoaded`, fetch `/api/price`
- On success: hide loading, populate all fields, show card
- On error: hide loading, show error message
- Format `fetchedAt` using `Intl.DateTimeFormat` with the user's locale, including date and time
- Format prices to 2 decimal places

Here is the complete file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EU ETS CO2 Price in CHF</title>
    <style>
      *,
      *::before,
      *::after {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0a0a0f;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          sans-serif;
        color: #e2e8f0;
        padding: 1rem;
      }

      .card {
        background: #1a1a2e;
        border: 1px solid #2a2a4a;
        border-radius: 1rem;
        padding: 2.5rem;
        max-width: 420px;
        width: 100%;
        text-align: center;
      }

      .card-title {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #64748b;
        margin-bottom: 0.5rem;
      }

      .card-subtitle {
        font-size: 0.95rem;
        color: #94a3b8;
        margin-bottom: 2rem;
      }

      .price-chf {
        font-size: 3.5rem;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1;
        margin-bottom: 0.25rem;
      }

      .price-chf .currency {
        font-size: 1.5rem;
        font-weight: 400;
        color: #38bdf8;
        vertical-align: super;
        margin-right: 0.25rem;
      }

      .price-eur {
        font-size: 1.1rem;
        color: #64748b;
        margin-bottom: 1.5rem;
      }

      .divider {
        border: none;
        border-top: 1px solid #2a2a4a;
        margin: 1.5rem 0;
      }

      .meta {
        font-size: 0.8rem;
        color: #475569;
        line-height: 1.8;
      }

      .meta .label {
        color: #64748b;
      }

      .loading {
        color: #64748b;
        font-size: 0.95rem;
      }

      .spinner {
        display: inline-block;
        width: 1.25rem;
        height: 1.25rem;
        border: 2px solid #2a2a4a;
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 0.75rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .error {
        color: #f87171;
        font-size: 0.95rem;
      }

      .hidden {
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div id="loading" class="loading">
        <div class="spinner"></div>
        <div>Fetching current price...</div>
      </div>

      <div id="content" class="hidden">
        <div class="card-title">EU ETS CO2 Allowance</div>
        <div class="card-subtitle">Price per ton</div>
        <div class="price-chf">
          <span class="currency">CHF</span>
          <span id="chf-value">—</span>
        </div>
        <div class="price-eur">
          <span id="eur-value">—</span> EUR
        </div>
        <hr class="divider" />
        <div class="meta">
          <div>
            <span class="label">Exchange rate:</span>
            1 EUR = <span id="rate-value">—</span> CHF
          </div>
          <div>
            <span class="label">Last updated:</span>
            <span id="updated-value">—</span>
          </div>
        </div>
      </div>

      <div id="error" class="hidden error">
        Price unavailable. Please try again later.
      </div>
    </div>

    <script>
      document.addEventListener("DOMContentLoaded", async () => {
        const loading = document.getElementById("loading")
        const content = document.getElementById("content")
        const error = document.getElementById("error")

        try {
          const response = await fetch("/api/price")
          if (!response.ok) throw new Error("Request failed")

          const data = await response.json()
          if (data.error) throw new Error(data.error)

          document.getElementById("chf-value").textContent =
            data.priceChf.toFixed(2)
          document.getElementById("eur-value").textContent =
            data.priceEur.toFixed(2)
          document.getElementById("rate-value").textContent =
            data.exchangeRate.toFixed(4)
          document.getElementById("updated-value").textContent =
            new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(data.fetchedAt))

          loading.classList.add("hidden")
          content.classList.remove("hidden")
        } catch (e) {
          loading.classList.add("hidden")
          error.classList.remove("hidden")
        }
      })
    </script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add dark-themed frontend card UI"
```

---

### Task 5: Manual Smoke Test

- [ ] **Step 1: Install Netlify CLI if needed**

Run: `npx netlify --version`
If not available: `npm install -g netlify-cli`

- [ ] **Step 2: Start local dev server**

Run: `npx netlify dev`
Expected: Server starts on `http://localhost:8888`

- [ ] **Step 3: Test the function endpoint**

Open `http://localhost:8888/api/price` in a browser or curl it:
Run: `curl http://localhost:8888/api/price`

Expected: JSON response like:
```json
{
  "priceEur": 87.16,
  "priceChf": 82.43,
  "exchangeRate": 0.9457,
  "fetchedAt": "2026-06-08T14:30:00Z"
}
```

Verify:
- `priceEur` is a positive number (should be in the 50-150 range currently)
- `exchangeRate` is a positive number (EUR/CHF is typically 0.92-0.98)
- `priceChf` equals `priceEur * exchangeRate` rounded to 2 decimals
- `fetchedAt` is a recent ISO timestamp

- [ ] **Step 4: Test the frontend**

Open `http://localhost:8888` in a browser.

Verify:
- Loading spinner appears briefly
- Card displays with CHF price (large), EUR price (smaller), exchange rate, and last updated time
- Dark theme renders correctly
- Card is centered and responsive (resize window to check)

- [ ] **Step 5: Final commit if any fixes were needed**

If any tweaks were made during testing, commit them.
