"use client"

import { useState } from "react"

/**
 * Copies `value` to the clipboard. Renders as a small outline button that
 * briefly swaps its label for `copiedLabel` so the operator gets feedback.
 * Clipboard access can be unavailable (insecure context / denied permission);
 * in that case the click is a silent no-op rather than an error.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
  title,
}: {
  value: string
  label: string
  copiedLabel: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleCopy}
      title={title ?? label}
      aria-label={title ?? label}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
