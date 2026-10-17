import {
  assertNonNegativeMinorUnits,
  compareMoney,
  parseDecimalToMinorUnits,
} from "../../common/money/money"

export interface LineCalculationInput {
  unit_amount: bigint
  quantity: number
}

export function calculateLineSubtotal(input: LineCalculationInput): bigint {
  return input.unit_amount * BigInt(input.quantity)
}

export function calculateTotals(params: {
  subtotal: bigint
  shipping: bigint
  discount: bigint
}): { total: bigint } {
  const total = params.subtotal + params.shipping - params.discount
  if (total < 0n) throw new Error("Order total cannot be negative")
  return { total }
}

export function parsePriceMinorUnits(
  input: { price_amount?: bigint; price?: string; minor_digits: number },
): bigint {
  if (input.price_amount !== undefined) {
    return assertNonNegativeMinorUnits(input.price_amount, "price_amount")
  }
  if (input.price !== undefined) {
    return assertNonNegativeMinorUnits(
      parseDecimalToMinorUnits(input.price, input.minor_digits),
      "price",
    )
  }
  throw new Error("Price is required")
}