import Link from "next/link"
import type { Category, Product } from "@/lib/api-types"
import {
  getStoreSettingsSafe,
  listCategories,
  listProducts,
} from "@/lib/api"
import { translate } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { ProductGrid } from "@/components/product-grid"
import { ProductImage } from "@/components/product-image"
import { CtaLink, EmptyState } from "@/components/ui"
import { storeBranding } from "@/config/store"

export async function generateMetadata() {
  const locale = await getLocale()
  return pageMetadata({
    path: "/",
    description: storeBranding.tagline || translate(locale, "home.heroFallbackSubtitle"),
  })
}

const RECENT_POOL = 24
const SECTION_LIMIT = 8

/** Products curated from the admin via the "featured" flag. */
async function loadFeatured(): Promise<Product[]> {
  const { limit } = storeBranding.featured
  const page = await listProducts({ status: "published", featured: true, pageSize: limit })
  return page.data
}

/** Newest published products, used by the offers and new-products rows. */
async function loadRecent(): Promise<Product[]> {
  const page = await listProducts({ status: "published", pageSize: RECENT_POOL })
  return page.data
}

/** First available media URL for a product, if any. */
function primaryImage(product: Product): string | null {
  return product.thumbnail ?? product.images[0]?.url ?? null
}

/** True only when a real discount (compare-at above price) exists. */
function hasDiscount(product: Product): boolean {
  const variant = product.variants.find((item) => item.is_default) ?? product.variants[0]
  if (!variant?.compare_at_amount) return false
  return Number(variant.compare_at_amount) > Number(variant.price_amount)
}

type BenefitIconName = "cash" | "truck" | "box" | "support"

function BenefitIcon({ name }: { name: BenefitIconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  if (name === "cash") {
    return (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    )
  }
  if (name === "truck") {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    )
  }
  if (name === "box") {
    return (
      <svg {...common}>
        <path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2zM20 13v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
      <path d="M17 18v1a2 2 0 0 1-2 2h-2" />
    </svg>
  )
}

function CategoryGlyph({ slug }: { slug: string }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  switch (slug) {
    case "electronics":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M12 16v4M8 20h8" />
        </svg>
      )
    case "phones-tablets":
      return (
        <svg {...common}>
          <rect x="7" y="3" width="10" height="18" rx="2.5" />
          <path d="M10.5 18h3" />
        </svg>
      )
    case "fashion":
      return (
        <svg {...common}>
          <path d="M9 3 5 4.5 3.5 9 6 10v10h12V10l2.5-1L19 4.5 15 3l-3 2.5z" />
        </svg>
      )
    case "home-kitchen":
      return (
        <svg {...common}>
          <path d="M4 11 12 4l8 7" />
          <path d="M6 10v10h12V10" />
          <path d="M10 20v-5h4v5" />
        </svg>
      )
    case "beauty":
      return (
        <svg {...common}>
          <path d="M12 3.5 13.7 8.3 18.5 10 13.7 11.7 12 16.5 10.3 11.7 5.5 10 10.3 8.3z" />
          <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
        </svg>
      )
    case "sports":
      return (
        <svg {...common}>
          <path d="M6.5 6.5v11M17.5 6.5v11M4 9.5v5M20 9.5v5M6.5 12h11" />
        </svg>
      )
    case "baby":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M9 15c.9.9 1.9 1.3 3 1.3s2.1-.4 3-1.3" />
        </svg>
      )
    case "groceries":
      return (
        <svg {...common}>
          <path d="M4 9h16l-1.4 8.6A2 2 0 0 1 16.6 19H7.4a2 2 0 0 1-2-1.4z" />
          <path d="M8.5 9 12 3.5 15.5 9" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" />
          <circle cx="7.5" cy="7.5" r="1.3" />
        </svg>
      )
  }
}

export default async function HomePage() {
  const locale = await getLocale()

  const [categories, settings] = await Promise.all([
    listCategories().catch(() => [] as Category[]),
    getStoreSettingsSafe(),
  ])

  let featuredProducts: Product[] = []
  try {
    featuredProducts = await loadFeatured()
  } catch {
    featuredProducts = []
  }

  let recent: Product[] = []
  try {
    recent = [...(await loadRecent())].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  } catch {
    recent = []
  }

  // Each discovery row claims the products it shows so the same product is not
  // repeated across sections. Rows with nothing left to show stay hidden.
  const shown = new Set<string>()
  const uniqueRow = (source: Product[], limit = SECTION_LIMIT): Product[] => {
    const picked: Product[] = []
    for (const product of source) {
      if (shown.has(product.handle)) continue
      shown.add(product.handle)
      picked.push(product)
      if (picked.length >= limit) break
    }
    return picked
  }

  const offerRow = uniqueRow(recent.filter(hasDiscount))
  const featuredRow = uniqueRow(featuredProducts)
  const newProductRow = uniqueRow(recent)

  const heroProduct = [...featuredProducts, ...recent].find((product) => primaryImage(product))
  const heroImage = heroProduct ? primaryImage(heroProduct) : null

  const codEnabled = settings?.cod_enabled ?? true
  const hasSupport = Boolean(storeBranding.support.phone || storeBranding.support.email)

  const benefits: Array<{ icon: BenefitIconName; title: string; description: string }> = []
  if (codEnabled) {
    benefits.push({
      icon: "cash",
      title: translate(locale, "home.benefits.cod"),
      description: translate(locale, "home.benefits.codDesc"),
    })
  }
  benefits.push({
    icon: "truck",
    title: translate(locale, "home.benefits.shipping"),
    description: translate(locale, "home.benefits.shippingDesc"),
  })
  benefits.push({
    icon: "box",
    title: translate(locale, "checkout.methodHome"),
    description: translate(locale, "checkout.methodStopDesk"),
  })
  if (hasSupport) {
    benefits.push({
      icon: "support",
      title: translate(locale, "home.benefits.support"),
      description: translate(locale, "home.benefits.supportDesc"),
    })
  }

  const heroTitle = storeBranding.hero.title ?? translate(locale, "home.heroFallbackTitle")
  const heroSubtitle = storeBranding.hero.subtitle ?? translate(locale, "home.heroFallbackSubtitle")

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-content">
          <p className="home-hero-eyebrow">
            {codEnabled ? (
              <span className="home-hero-chip">{translate(locale, "product.trustCod")}</span>
            ) : null}
            <span className="home-hero-chip">{translate(locale, "home.benefits.shipping")}</span>
          </p>
          <h1 id="home-hero-title" className="home-hero-title">
            {heroTitle}
          </h1>
          <p className="home-hero-subtitle">{heroSubtitle}</p>
          <div className="hero-actions">
            <CtaLink href="/products">{translate(locale, "home.shopNow")}</CtaLink>
            {categories.length > 0 ? (
              <CtaLink href="#categories" variant="outline">
                {translate(locale, "home.categories")}
              </CtaLink>
            ) : null}
          </div>
        </div>
        {heroProduct && heroImage ? (
          <Link
            href={`/products/${heroProduct.handle}`}
            className="home-hero-media"
            aria-label={heroProduct.title}
          >
            <ProductImage
              src={heroImage}
              alt={heroProduct.title}
              sizes="(max-width: 900px) 100vw, 40vw"
              priority
            />
          </Link>
        ) : null}
      </section>

      {/* Shop by category */}
      <section className="section" id="categories" aria-labelledby="home-categories">
        <div className="section-head">
          <h2 id="home-categories" className="section-title">
            {translate(locale, "home.categories")}
          </h2>
          <CtaLink href="/products" variant="outline">
            {translate(locale, "home.viewAll")}
          </CtaLink>
        </div>
        {categories.length > 0 ? (
          <div className="category-grid">
            {categories.map((category) => {
              const imageUrl = storeBranding.categoryImages[category.slug] ?? null
              return (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="card category-card"
                  aria-label={translate(locale, "categories.browse", { name: category.name })}
                >
                  {imageUrl ? (
                    <span className="category-media" aria-hidden="true">
                      <ProductImage src={imageUrl} alt={category.name} sizes="(max-width: 767px) 45vw, 200px" />
                    </span>
                  ) : (
                    <span className="category-icon" aria-hidden="true">
                      <CategoryGlyph slug={category.slug} />
                    </span>
                  )}
                  <span className="category-body">
                    <span className="category-name">{category.name}</span>
                    {category._count ? (
                      <span className="category-count">
                        {translate(locale, "categories.productCount", {
                          count: category._count.products,
                        })}
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={translate(locale, "categories.empty")}
            action={<CtaLink href="/products">{translate(locale, "products.emptyCta")}</CtaLink>}
          />
        )}
      </section>

      {/* Special offers — populated when the catalog carries discounts */}
      <section className="section" id="offers" aria-labelledby="home-offers">
        <div className="section-head">
          <h2 id="home-offers" className="section-title">
            {translate(locale, "home.specialOffers")}
          </h2>
          <CtaLink href="/products" variant="outline">
            {translate(locale, "home.viewAll")}
          </CtaLink>
        </div>
        <ProductGrid
          products={offerRow}
          locale={locale}
          empty={{ title: translate(locale, "home.specialOffersEmpty") }}
        />
      </section>

      {/* Featured products */}
      <section className="section" id="featured" aria-labelledby="home-featured">
        <div className="section-head">
          <h2 id="home-featured" className="section-title">
            {translate(locale, "home.featured")}
          </h2>
          <CtaLink href="/products" variant="outline">
            {translate(locale, "home.viewAll")}
          </CtaLink>
        </div>
        <ProductGrid
          products={featuredRow}
          locale={locale}
          empty={{ title: translate(locale, "home.featuredEmpty") }}
        />
      </section>

      {/* New products */}
      <section className="section" id="new-products" aria-labelledby="home-new-products">
        <div className="section-head">
          <h2 id="home-new-products" className="section-title">
            {translate(locale, "home.newProducts")}
          </h2>
          <CtaLink href="/products" variant="outline">
            {translate(locale, "home.viewAll")}
          </CtaLink>
        </div>
        <ProductGrid
          products={newProductRow}
          locale={locale}
          empty={{ title: translate(locale, "home.newProductsEmpty") }}
        />
      </section>

      {/* COD and delivery benefits */}
      {benefits.length > 0 ? (
        <section className="section" id="benefits" aria-labelledby="home-benefits">
          <div className="section-head">
            <h2 id="home-benefits" className="section-title">
              {translate(locale, "home.benefits.title")}
            </h2>
          </div>
          <ul className="benefit-grid">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="card card-pad benefit-card">
                <span className="benefit-icon" aria-hidden="true">
                  <BenefitIcon name={benefit.icon} />
                </span>
                <div className="benefit-body">
                  <h3>{benefit.title}</h3>
                  <p className="muted">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
