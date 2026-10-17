import Link from "next/link"
import type { Product } from "@/lib/api-types"
import { translate, type Locale } from "@/lib/i18n"
import { defaultVariantIndex, isVariantAvailable } from "@/lib/inventory"
import { formatMoney } from "@/lib/money"
import { ProductImage } from "./product-image"
import { Badge, Price } from "./ui"

export function ProductCard({
  product,
  locale,
  priority = false,
}: {
  product: Product
  locale: Locale
  priority?: boolean
}) {
  const variant = product.variants[defaultVariantIndex(product)]
  const image = product.thumbnail ?? product.images[0]?.url ?? null
  const available = variant ? isVariantAvailable(variant) : false
  const compareAmount = variant?.compare_at_amount ? Number(variant.compare_at_amount) : 0
  const priceAmount = variant ? Number(variant.price_amount) : 0
  const hasDiscount = compareAmount > priceAmount
  const discountPercent = hasDiscount
    ? Math.round(((compareAmount - priceAmount) / compareAmount) * 100)
    : 0

  return (
    <Link href={`/products/${product.handle}`} className="card product-card">
      <div className="product-card-media">
        <ProductImage
          src={image}
          alt={product.title}
          sizes="(max-width: 720px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />
        {hasDiscount ? (
          <span className="badge badge-danger product-discount-badge">-{discountPercent}%</span>
        ) : null}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-title">{product.title}</h3>
        <span className="badge badge-success product-card-cod">
          {translate(locale, "product.trustCod")}
        </span>
        <div className="product-card-footer">
          {variant ? (
            <span className="product-card-prices">
              <Price
                className="product-card-price"
                amount={variant.price_amount}
                currency={variant.currency_code}
                locale={locale}
              />
              {hasDiscount ? (
                <span className="price-compare product-card-compare">
                  {formatMoney(variant.compare_at_amount!, variant.currency_code, locale)}
                </span>
              ) : null}
            </span>
          ) : null}
          {!available ? <Badge tone="danger">{translate(locale, "product.outOfStock")}</Badge> : null}
        </div>
      </div>
    </Link>
  )
}
