"use client"

import { useEffect } from "react"
import { translate } from "@/lib/i18n"
import { DEFAULT_LOCALE } from "@/lib/i18n/locales"

/** Root error boundary (covers the admin area; the storefront has its own). */
export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container">
      <div className="page text-center" role="alert">
        <h1>{translate(DEFAULT_LOCALE, "error.title")}</h1>
        <p className="muted">{translate(DEFAULT_LOCALE, "error.body")}</p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          {translate(DEFAULT_LOCALE, "common.retry")}
        </button>
      </div>
    </main>
  )
}
