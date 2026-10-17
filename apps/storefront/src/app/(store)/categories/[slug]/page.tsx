import Link from "next/link"
import { notFound } from "next/navigation"
import type { Category, Product } from "@/lib/api-types"
import { listCategories, listProducts } from "@/lib/api"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { Pagination } from "@/components/pagination"
import { ProductGrid } from "@/components/product-grid"
import { Alert, CtaLink } from "@/components/ui"

const PAGE_SIZE = 12

function toPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const categories = await listCategories()
    const category = categories.find((item) => item.slug === slug)
    return pageMetadata({ path: `/categories/${slug}`, title: category?.name ?? slug })
  } catch {
    return pageMetadata({ path: `/categories/${slug}` })
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const query = await searchParams
  const locale = await getLocale()
  const page = toPage(query.page)

  let categories: Category[] = []
  let failed = false
  try {
    categories = await listCategories()
  } catch {
    failed = true
  }

  const category = categories.find((item) => item.slug === slug)
  if (!failed && !category) notFound()

  let products: Product[] = []
  let totalPages = 1
  let total = 0
  try {
    const result = await listProducts({
      status: "published",
      category: slug,
      page,
      pageSize: PAGE_SIZE,
    })
    products = result.data
    total = result.total
    totalPages = Math.max(1, result.totalPages)
  } catch {
    failed = true
  }

  if (failed && !category) {
    return (
      <div className="page">
        <Alert tone="error" role="alert">
          <p style={{ margin: 0 }}>{translate(locale, "common.errorBody")}</p>
          <CtaLink href={`/categories/${slug}`} variant="outline">
            {translate(locale, "common.retry")}
          </CtaLink>
        </Alert>
      </div>
    )
  }

  const title = category?.name ?? slug

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link href="/">{translate(locale, "nav.home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products">{translate(locale, "nav.products")}</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>

      <h1 className="page-title">{title}</h1>
      {category?.description ? <p className="muted">{category.description}</p> : null}
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
        basePath={`/categories/${slug}`}
        params={{}}
        locale={locale}
      />
    </div>
  )
}
