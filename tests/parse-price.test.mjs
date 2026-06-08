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
