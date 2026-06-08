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
