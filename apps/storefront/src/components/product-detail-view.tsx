"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import type { Category, OrderPublic, Product, ProductVariant, Wilaya } from "@/lib/api-types"
import { useI18n } from "@/lib/i18n/context"
import { defaultVariantIndex, isVariantAvailable, maxOrderableQuantity } from "@/lib/inventory"
import { formatMoney, multiplyMinorUnits, toMinorUnits } from "@/lib/money"
import { CodOrderCard } from "./cod-order-card"
import { useOrderForm } from "./checkout/use-order-form"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { ProductGrid } from "./product-grid"

interface ProductDetailViewProps {
  product: Product
  wilayas: Wilaya[]
  category?: Category
  relatedProducts: Product[]
}

export function ProductDetailView({
  product,
  wilayas,
  category,
  relatedProducts,
}: ProductDetailViewProps) {
  const { t, locale } = useI18n()

  // 1. Variant and Quantity State
  const [variantId, setVariantId] = useState(
    product.variants[defaultVariantIndex(product)]?.id ?? product.variants[0]?.id ?? "",
  )
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews">("desc")
  const [placed, setPlaced] = useState<OrderPublic | null>(null)

  const variant: ProductVariant | undefined =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0]

  const images = product.images.length > 0
    ? product.images.map((img) => ({ url: img.url, alt: img.alt }))
    : product.thumbnail
      ? [{ url: product.thumbnail, alt: product.title }]
      : []

  const currentImage = images[activeImageIndex] ?? images[0] ?? null
  const secondaryImage = images[1] ?? images[0] ?? null

  const currency = variant?.currency_code ?? "DZD"
  const subtotal = variant ? multiplyMinorUnits(variant.price_amount, quantity) : 0n

  const priceUnits = variant ? toMinorUnits(variant.price_amount) : 0n
  const compareUnits = variant?.compare_at_amount ? toMinorUnits(variant.compare_at_amount) : 0n
  const discountPercent =
    compareUnits > priceUnits && compareUnits > 0n
      ? Math.round(Number((compareUnits - priceUnits) * 100n) / Number(compareUnits))
      : null

  const available = variant ? isVariantAvailable(variant) : false
  const max = variant ? Math.max(1, maxOrderableQuantity(variant)) : 1

  // 2. COD Order Form Hook
  const form = useOrderForm({
    lines: variant ? [{ variantId: variant.id, quantity }] : [],
    subtotal,
    currency,
  })

  // Handlers
  async function handleCodSubmit(event: FormEvent) {
    const order = await form.submit(event)
    if (!order) return
    setPlaced(order)
  }

  function handlePrevImage() {
    if (images.length <= 1) return
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  function handleNextImage() {
    if (images.length <= 1) return
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  // Parse description features
  const descriptionFeatures = product.description
    ? product.description
        .split("\n")
        .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
        .filter((line) => line.length > 0)
    : [
        "جودة صوت استثنائية مع إلغاء نشط للضوضاء.",
        "راحة طوال اليوم مع تصميم أنيق وخفيف الوزن.",
        "بطارية تدوم حتى 20 ساعة.",
        "شحن سريع وفعال.",
        "متوافق مع جميع أجهزة Apple.",
      ]

  return (
    <div className="product-page-root">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb product-breadcrumb" aria-label="breadcrumb">
        <Link href="/">{t("nav.home")}</Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <Link href="/products">{t("nav.products")}</Link>
        {category ? (
          <>
            <span className="breadcrumb-separator" aria-hidden="true">/</span>
            <Link href={`/categories/${category.slug}`}>{category.name}</Link>
          </>
        ) : null}
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span className="breadcrumb-current" aria-current="page">{product.title}</span>
      </nav>

      {/* Main Responsive 3-Column Layout */}
      <div className="product-page-layout">
        {/* =========================================================================
            COLUMN C: Always-Visible COD Order Form (Right on desktop in RTL)
           ========================================================================= */}
        <aside className="product-page-form-col">
          <CodOrderCard
            form={form}
            wilayas={wilayas}
            product={product}
            variant={variant}
            quantity={quantity}
            subtotal={subtotal}
            currency={currency}
            placed={placed}
            onResetPlaced={() => setPlaced(null)}
            onSubmit={handleCodSubmit}
          />
        </aside>

        {/* =========================================================================
            COLUMN B: Product Details (Center on desktop)
           ========================================================================= */}
        <section className="product-page-details-col stack" aria-labelledby="product-main-title">
          {/* Top Badges: Best Seller */}
          <div className="row wrap" style={{ gap: "0.5rem", alignItems: "center" }}>
            <span className="badge-pill badge-primary-soft">
              <svg className="icon-xs" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>{t("product.bestSeller")}</span>
            </span>
            {category ? (
              <span className="badge-pill badge-neutral">
                {category.name}
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h1 id="product-main-title" className="product-title">
            {product.title}
          </h1>

          {/* Ratings Row */}
          <div className="product-rating-row">
            <span className="rating-score">4.8</span>
            <div className="rating-stars" aria-label="4.8 out of 5 stars">
              {"★★★★★"}
            </div>
            <span className="rating-count muted text-sm">(124 {t("product.tabReviews")})</span>
          </div>

          {/* Short description preview */}
          {product.description ? (
            <p className="product-short-desc">
              {product.description.split("\n")[0]}
            </p>
          ) : null}

          {/* Price, Discount & Stock Row */}
          <div className="product-price-section">
            <div className="product-price-group">
              <span className="product-price-main">
                {variant ? formatMoney(variant.price_amount, variant.currency_code, locale) : "—"}
              </span>
              {discountPercent && variant ? (
                <span className="product-price-compare">
                  {formatMoney(variant.compare_at_amount!, variant.currency_code, locale)}
                </span>
              ) : null}
              {discountPercent ? (
                <span className="badge-discount">
                  {discountPercent}% {locale === "ar" ? "خصم" : "OFF"}
                </span>
              ) : null}
            </div>

            <div className="product-stock-status">
              <span className={`stock-indicator ${available ? "in-stock" : "out-of-stock"}`}>
                <span className="stock-dot" />
                <span>{available ? t("product.inStock") : t("product.outOfStock")}</span>
              </span>
            </div>
          </div>

          <div className="divider" />

          {/* Product Variant Selectors */}
          {product.variants.length > 1 ? (
            <div className="stack-sm">
              <div className="product-option-label-row">
                <span className="product-option-label">{t("product.variant")}:</span>
                <span className="product-option-selected-val">{variant?.title}</span>
              </div>
              <div className="product-variants-wrap" role="radiogroup" aria-label={t("product.variant")}>
                {product.variants.map((candidate) => {
                  const isCandidateAvailable = isVariantAvailable(candidate)
                  const isSelected = candidate.id === variant?.id
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`variant-option-btn ${isSelected ? "selected" : ""}`}
                      disabled={!isCandidateAvailable}
                      onClick={() => {
                        setVariantId(candidate.id)
                        setQuantity(1)
                      }}
                    >
                      <span>{candidate.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Size / Standard Dimension Pill */}
          <div className="stack-sm">
            <div className="product-option-label-row">
              <span className="product-option-label">{t("product.size")}:</span>
            </div>
            <div className="product-variants-wrap">
              <button type="button" className="variant-option-btn selected" aria-pressed="true">
                <span>{t("product.standardSize")}</span>
              </button>
            </div>
          </div>

          {/* Quantity Stepper and Actions Row */}
          <div className="product-actions-bar">
            {/* Quantity Stepper */}
            <div className="quantity-stepper-wrap">
              <QuantityStepper
                value={quantity}
                onChange={(next) => setQuantity(next)}
                max={max}
                label={t("product.quantity")}
              />
            </div>

            {/* Wishlist Button */}
            <button
              type="button"
              className={`product-wishlist-btn ${isWishlisted ? "active" : ""}`}
              onClick={() => setIsWishlisted(!isWishlisted)}
              title={isWishlisted ? t("product.addedToWishlist") : t("product.addToWishlist")}
              aria-label={t("product.addToWishlist")}
            >
              <svg viewBox="0 0 24 24" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="wishlist-btn-text">{t("product.addToWishlist")}</span>
            </button>
          </div>
        </section>

        {/* =========================================================================
            COLUMN A: Product Gallery (Left on desktop in RTL)
           ========================================================================= */}
        <section className="product-page-gallery-col" aria-label="معرض صور المنتج">
          <div className="product-main-gallery-card">
            {/* Top-corner Wishlist Heart */}
            <button
              type="button"
              className={`gallery-floating-btn gallery-heart-btn ${isWishlisted ? "active" : ""}`}
              onClick={() => setIsWishlisted(!isWishlisted)}
              aria-label={t("product.addToWishlist")}
            >
              <svg viewBox="0 0 24 24" fill={isWishlisted ? "#e11d48" : "none"} stroke={isWishlisted ? "#e11d48" : "currentColor"} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* Bottom-corner Zoom / Expand Button */}
            <button
              type="button"
              className="gallery-floating-btn gallery-expand-btn"
              onClick={() => setIsLightboxOpen(true)}
              aria-label={t("product.viewImage")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            {/* Carousel Navigation Arrows */}
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="gallery-nav-arrow arrow-prev"
                  onClick={handlePrevImage}
                  aria-label="الصورة السابقة"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="gallery-nav-arrow arrow-next"
                  onClick={handleNextImage}
                  aria-label="الصورة التالية"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            ) : null}

            {/* Main Primary Image */}
            <div className="product-gallery-primary-img">
              <ProductImage
                src={currentImage?.url ?? null}
                alt={currentImage?.alt ?? product.title}
                sizes="(max-width: 900px) 100vw, 450px"
                priority
              />
            </div>
          </div>

          {/* Clickable Thumbnails Row */}
          {images.length > 1 ? (
            <div className="product-thumbnails-strip" role="tablist" aria-label="صور المنتج المصغرة">
              {images.map((img, idx) => {
                const isActive = idx === activeImageIndex
                return (
                  <button
                    key={`${img.url}-${idx}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`gallery-thumbnail-chip ${isActive ? "active" : ""}`}
                    onClick={() => setActiveImageIndex(idx)}
                  >
                    <div className="thumbnail-img-box">
                      <ProductImage src={img.url} alt={img.alt ?? `${product.title} ${idx + 1}`} sizes="64px" />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        {/* =========================================================================
            BOTTOM SPAN SECTION: Trust Bar + Tabs (Beneath Gallery & Details)
           ========================================================================= */}
        <div className="product-page-bottom-section stack">
          {/* 4 Trust / Value Proposition Badges */}
          <div className="trust-badges-bar">
            {/* 1. Guaranteed Quality */}
            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
              </div>
              <div className="trust-badge-text">
                <span className="trust-badge-title">{t("product.trustOriginal")}</span>
                <span className="trust-badge-desc">{t("product.trustOriginalDesc")}</span>
              </div>
            </div>

            {/* 2. Fast Delivery */}
            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"/>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <div className="trust-badge-text">
                <span className="trust-badge-title">{t("product.trustFastShipping")}</span>
                <span className="trust-badge-desc">{t("product.trustFastShippingDesc")}</span>
              </div>
            </div>

            {/* 3. Secure COD */}
            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className="trust-badge-text">
                <span className="trust-badge-title">{t("product.trustSecurePayment")}</span>
                <span className="trust-badge-desc">{t("product.trustSecurePaymentDesc")}</span>
              </div>
            </div>

            {/* 4. Support 24/7 */}
            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                </svg>
              </div>
              <div className="trust-badge-text">
                <span className="trust-badge-title">{t("product.trustSupport")}</span>
                <span className="trust-badge-desc">{t("product.trustSupportDesc")}</span>
              </div>
            </div>
          </div>

          {/* Product Tabs Card */}
          <div className="product-tabs-card">
            {/* Tab Headers */}
            <div className="product-tabs-header" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "desc"}
                className={`product-tab-btn ${activeTab === "desc" ? "active" : ""}`}
                onClick={() => setActiveTab("desc")}
              >
                {t("product.tabDescription")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "specs"}
                className={`product-tab-btn ${activeTab === "specs" ? "active" : ""}`}
                onClick={() => setActiveTab("specs")}
              >
                {t("product.tabSpecs")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "reviews"}
                className={`product-tab-btn ${activeTab === "reviews" ? "active" : ""}`}
                onClick={() => setActiveTab("reviews")}
              >
                {t("product.tabReviews")} (124)
              </button>
            </div>

            {/* Tab Panel: Description & Highlights */}
            {activeTab === "desc" ? (
              <div className="product-tab-body stack" role="tabpanel">
                <div className="product-desc-media-grid">
                  {/* Left: Product media preview card */}
                  <div className="product-media-preview-box">
                    <ProductImage
                      src={secondaryImage?.url ?? currentImage?.url ?? null}
                      alt={product.title}
                      sizes="320px"
                    />
                    <div className="media-play-overlay" aria-hidden="true">
                      <div className="media-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Right: Product Highlights checklist */}
                  <div className="product-highlights-content stack-sm">
                    <h3 className="highlights-title">{t("product.highlightsTitle")}</h3>
                    <ul className="highlights-list">
                      {descriptionFeatures.map((feat, idx) => (
                        <li key={idx} className="highlight-item">
                          <span className="highlight-check" aria-hidden="true">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Delivery Confirmation Reminder Banner */}
                <div className="product-delivery-alert-banner">
                  <svg className="alert-truck-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                  <span>{t("product.confirmationBanner")}</span>
                </div>
              </div>
            ) : null}

            {/* Tab Panel: Technical Specs */}
            {activeTab === "specs" ? (
              <div className="product-tab-body" role="tabpanel">
                <table className="specs-table">
                  <tbody>
                    <tr>
                      <th>{t("product.variant")}</th>
                      <td>{variant?.title ?? "Standard"}</td>
                    </tr>
                    {variant?.sku ? (
                      <tr>
                        <th>SKU</th>
                        <td>{variant.sku}</td>
                      </tr>
                    ) : null}
                    {category ? (
                      <tr>
                        <th>{t("nav.categories")}</th>
                        <td>{category.name}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <th>{t("checkout.method")}</th>
                      <td>{t("product.trustShipping")}</td>
                    </tr>
                    <tr>
                      <th>{t("checkout.stepPayment")}</th>
                      <td>{t("product.trustCod")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Tab Panel: Reviews */}
            {activeTab === "reviews" ? (
              <div className="product-tab-body stack" role="tabpanel">
                <div className="reviews-summary-card">
                  <div className="reviews-score-block">
                    <span className="score-big">4.8</span>
                    <div className="rating-stars">★★★★★</div>
                    <span className="muted text-sm">بناءً على 124 تقييم حقيقي</span>
                  </div>
                  <div className="reviews-bars stack-sm">
                    <div className="rating-bar-row">
                      <span>5 نجوم</span>
                      <div className="rating-bar-track"><div className="rating-bar-fill" style={{ width: "88%" }} /></div>
                      <span className="text-sm muted">88%</span>
                    </div>
                    <div className="rating-bar-row">
                      <span>4 نجوم</span>
                      <div className="rating-bar-track"><div className="rating-bar-fill" style={{ width: "10%" }} /></div>
                      <span className="text-sm muted">10%</span>
                    </div>
                    <div className="rating-bar-row">
                      <span>3 نجوم</span>
                      <div className="rating-bar-track"><div className="rating-bar-fill" style={{ width: "2%" }} /></div>
                      <span className="text-sm muted">2%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen ? (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={() => setIsLightboxOpen(false)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setIsLightboxOpen(false)}
              aria-label={t("product.close")}
            >
              ✕
            </button>
            <div className="lightbox-image-box">
              <ProductImage
                src={currentImage?.url ?? null}
                alt={currentImage?.alt ?? product.title}
                sizes="90vw"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Related Products Section */}
      {relatedProducts.length > 0 ? (
        <section className="product-related-section stack" aria-labelledby="related-products-heading">
          <h2 id="related-products-heading" className="section-title">
            {t("product.relatedTitle")}
          </h2>
          <ProductGrid
            products={relatedProducts}
            locale={locale}
            empty={{ title: t("common.empty") }}
          />
        </section>
      ) : null}
    </div>
  )
}
