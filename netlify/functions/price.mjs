import { parseEurPrice } from "../../src/parse-price.mjs"

const COMPENSATORS_URL =
  "https://www.compensators.org/wp-content/themes/compensators/DonationFirst_int.php?lang=en_GB"
const EXCHANGE_RATE_URL = "https://api.frankfurter.app/latest?from=EUR&to=CHF"

export default async function handler() {
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
