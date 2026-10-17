import Link from "next/link"
import type { Category, Product } from "@/lib/api-types"
import { listCategories, listProducts } from "@/lib/api"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { Pagination } from "@/components/pagination"
import { ProductGrid } from "@/components/product-grid"
import { Alert, CtaLink } from "@/components/ui"

const PAGE_SIZE = 12

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toPage(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1
}

export async function generateMetadata() {
  const locale = await getLocale()
  return pageMetadata({ path: "/products", title: translate(locale, "products.title") })
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const locale = await getLocale()
  const page = toPage(first(params.page))
  const search = first(params.q)?.trim() || undefined
  const category = first(params.category)?.trim() || undefined

  let products: Product[] = []
  let total = 0
  let totalPages = 1
  let failed = false

  try {
    const result = await listProducts({
      status: "published",
      page,
      pageSize: PAGE_SIZE,
      search,
      category,
    })
    products = result.data
    total = result.total
    totalPages = Math.max(1, result.totalPages)
  } catch {
    failed = true
  }

  let categories: Category[] = []
  try {
    categories = await listCategories()
  } catch {
    categories = []
  }

  return (
    <div className="page">
      <h1 className="page-title">{translate(locale, "products.title")}</h1>

      <form action="/products" method="get" role="search" className="row wrap" style={{ marginBottom: "var(--space-4)" }}>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder={translate(locale, "common.searchPlaceholder")}
          aria-label={translate(locale, "common.search")}
          style={{ maxWidth: "22rem" }}
        />
        <button type="submit" className="btn btn-primary">
          {translate(locale, "common.search")}
        </button>
      </form>

      {categories.length > 0 ? (
        <div className="chips" style={{ marginBottom: "var(--space-5)" }}>
          <Link href="/products" className="chip" aria-current={!category ? "true" : undefined}>
            {translate(locale, "common.all")}
          </Link>
          {categories.map((item) => (
            <Link
              key={item.id}
              href={`/products?category=${encodeURIComponent(item.slug)}`}
              className="chip"
              aria-current={category === item.slug ? "true" : undefined}
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}

      {failed ? (
        <Alert tone="error" role="alert">
          <p style={{ margin: 0 }}>{translate(locale, "common.errorBody")}</p>
          <CtaLink href="/products" variant="outline">
            {translate(locale, "common.retry")}
          </CtaLink>
        </Alert>
      ) : (
        <>
          {total > 0 ? (
            <p className="muted text-sm">{translate(locale, "products.resultsCount", { count: total })}</p>
          ) : null}
          <ProductGrid
            products={products}
            locale={locale}
            empty={{
              title: translate(locale, "products.empty"),
              action: <CtaLink href="/products">{translate(locale, "products.emptyCta")}</CtaLink>,
            }}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/products"
            params={{ q: search, category }}
            locale={locale}
          />
        </>
      )}
    </div>
  )
}
