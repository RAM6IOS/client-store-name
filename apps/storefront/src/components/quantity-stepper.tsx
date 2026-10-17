"use client"

import { clampQuantity, MAX_LINE_QUANTITY } from "@/lib/cart"

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = MAX_LINE_QUANTITY,
  label,
  describedBy,
}: {
  value: number
  onChange: (quantity: number) => void
  min?: number
  max?: number
  label: string
  describedBy?: string
}) {
  const effectiveMax = Math.max(min, max)

  function commit(next: number) {
    onChange(Math.min(effectiveMax, Math.max(min, clampQuantity(next))))
  }

  return (
    <div className="qty">
      <button
        type="button"
        aria-label="-"
        disabled={value <= min}
        onClick={() => commit(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        aria-describedby={describedBy}
        min={min}
        max={effectiveMax}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isFinite(parsed)) commit(parsed)
        }}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
      />
      <button
        type="button"
        aria-label="+"
        disabled={value >= effectiveMax}
        onClick={() => commit(value + 1)}
      >
        +
      </button>
    </div>
  )
}
