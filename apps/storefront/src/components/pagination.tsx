import Link from "next/link"
import { translate } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
  locale,
}: {
  page: number
  totalPages: number
  basePath: string
  params: Record<string, string | undefined>
  locale: Locale
}) {
  if (totalPages <= 1) return null

  const hrefFor = (target: number): string => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value)
    }
    if (target > 1) search.set("page", String(target))
    const query = search.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  const previous = page > 1 ? hrefFor(page - 1) : null
  const next = page < totalPages ? hrefFor(page + 1) : null

  return (
    <nav className="pagination" aria-label="pagination">
      {previous ? (
        <Link className="btn btn-outline" href={previous} rel="prev">
          {translate(locale, "products.prev")}
        </Link>
      ) : (
        <span className="btn btn-outline" aria-disabled="true">
          {translate(locale, "products.prev")}
        </span>
      )}
      <span className="muted text-sm">
        {translate(locale, "products.page", { page, total: totalPages })}
      </span>
      {next ? (
        <Link className="btn btn-outline" href={next} rel="next">
          {translate(locale, "products.next")}
        </Link>
      ) : (
        <span className="btn btn-outline" aria-disabled="true">
          {translate(locale, "products.next")}
        </span>
      )}
    </nav>
  )
}
