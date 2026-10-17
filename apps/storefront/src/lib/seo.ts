import type { Metadata } from "next"
import { siteConfig, storeBranding } from "@/config/store"
import { LOCALE_QUERY_PARAM } from "@/lib/i18n/locales"

/** hreflang alternates for a path, selecting each locale via `?lang=`. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ar: `${path}?${LOCALE_QUERY_PARAM}=ar`,
    fr: `${path}?${LOCALE_QUERY_PARAM}=fr`,
  }
}

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${siteConfig.url}${normalized}`
}

export interface PageMetadataInput {
  title?: string
  description?: string
  path: string
  images?: string[]
  /** Set for private pages (e.g. order tracking) that must not be indexed. */
  noIndex?: boolean
}

/**
 * Builds page metadata with canonical URL, hreflang alternates and Open Graph
 * tags. Private data must never be passed in `images`/`description` (see the
 * order-success page, which is explicitly `noIndex`).
 */
export function pageMetadata({
  title,
  description,
  path,
  images,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = canonicalUrl(path)
  const resolvedTitle = title ? `${title} | ${storeBranding.name}` : undefined
  const resolvedDescription = description ?? (storeBranding.tagline || undefined)

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url,
      siteName: storeBranding.name,
      title: resolvedTitle ?? storeBranding.name,
      description: resolvedDescription,
      images: images && images.length > 0 ? images : undefined,
    },
  }
}
