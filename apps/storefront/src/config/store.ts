/**
 * Storefront presentation configuration.
 *
 * This is the single, explicit boundary for per-client branding. Every value is
 * a deploy-time setting (env var) with a neutral default, so a client store can
 * be re-branded without touching business logic, components, or the API. It is
 * intentionally NOT a page builder or a multi-tenant configuration service.
 *
 * NEXT_PUBLIC_* variables are inlined by Next.js at build time and are safe to
 * expose to the browser (no secrets belong here).
 */

function env(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export interface StoreBranding {
  /** Customer-facing store name. Neutral by default — never the agency brand. */
  name: string
  tagline: string
  logoUrl: string | null
  colors: {
    primary: string
    primaryContrast: string
    accent: string
    background: string
    surface: string
    text: string
    muted: string
    border: string
    danger: string
  }
  fontFamily: string
  support: {
    phone: string | null
    email: string | null
    address: string | null
  }
  hero: {
    title: string | null
    subtitle: string | null
  }
  /** Homepage featured row. Products are curated via the admin "featured" flag. */
  featured: {
    limit: number
  }
  /** Optional category artwork keyed by category slug (JSON map). */
  categoryImages: Record<string, string>
}

export const storeBranding: StoreBranding = {
  name: env(process.env.NEXT_PUBLIC_STORE_NAME, "متجر").replace(/^BITA.*$/i, "متجر"),
  tagline: env(process.env.NEXT_PUBLIC_STORE_TAGLINE, ""),
  logoUrl: process.env.NEXT_PUBLIC_STORE_LOGO_URL?.trim() || null,
  colors: {
    primary: env(process.env.NEXT_PUBLIC_BRAND_PRIMARY, "#4f46e5"),
    primaryContrast: env(process.env.NEXT_PUBLIC_BRAND_PRIMARY_CONTRAST, "#ffffff"),
    accent: env(process.env.NEXT_PUBLIC_BRAND_ACCENT, "#818cf8"),
    background: env(process.env.NEXT_PUBLIC_BRAND_BACKGROUND, "#ffffff"),
    surface: env(process.env.NEXT_PUBLIC_BRAND_SURFACE, "#f8fafc"),
    text: env(process.env.NEXT_PUBLIC_BRAND_TEXT, "#0f172a"),
    muted: env(process.env.NEXT_PUBLIC_BRAND_MUTED, "#64748b"),
    border: env(process.env.NEXT_PUBLIC_BRAND_BORDER, "#e2e8f0"),
    danger: env(process.env.NEXT_PUBLIC_BRAND_DANGER, "#dc2626"),
  },
  fontFamily: env(
    process.env.NEXT_PUBLIC_STORE_FONT,
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif',
  ),
  support: {
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || null,
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null,
    address: process.env.NEXT_PUBLIC_SUPPORT_ADDRESS?.trim() || null,
  },
  hero: {
    title: process.env.NEXT_PUBLIC_HERO_TITLE?.trim() || null,
    subtitle: process.env.NEXT_PUBLIC_HERO_SUBTITLE?.trim() || null,
  },
  featured: {
    limit: clampInt(process.env.NEXT_PUBLIC_FEATURED_LIMIT, 8, 1, 24),
  },
  categoryImages: parseImageMap(process.env.NEXT_PUBLIC_CATEGORY_IMAGES),
}

/** Parses a JSON object of `{ slug: imageUrl }`; returns `{}` when invalid. */
function parseImageMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[key.trim()] = value.trim()
    }
    return out
  } catch {
    return {}
  }
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

export const siteConfig = {
  /** Absolute site URL used for canonical and social metadata. */
  url: env(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000").replace(/\/+$/, ""),
}
