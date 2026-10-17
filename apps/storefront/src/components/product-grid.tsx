import type { ReactNode } from "react"
import type { Product } from "@/lib/api-types"
import type { Locale } from "@/lib/i18n/locales"
import { ProductCard } from "./product-card"
import { EmptyState } from "./ui"

export function ProductGrid({
  products,
  locale,
  empty,
}: {
  products: Product[]
  locale: Locale
  empty: { title: string; description?: string; action?: ReactNode }
}) {
  if (products.length === 0) {
    return <EmptyState title={empty.title} description={empty.description} action={empty.action} />
  }

  return (
    <div className="grid-products">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} locale={locale} priority={index < 4} />
      ))}
    </div>
  )
}
