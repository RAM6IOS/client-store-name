import type { Metadata, Viewport } from "next"
import "./globals.css"
import { siteConfig, storeBranding } from "@/config/store"
import { Providers } from "@/components/providers"
import { directionOf } from "@/lib/i18n/locales"
import { getLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: storeBranding.name,
    template: `%s | ${storeBranding.name}`,
  },
  description: storeBranding.tagline || undefined,
  applicationName: storeBranding.name,
  openGraph: {
    type: "website",
    siteName: storeBranding.name,
    title: storeBranding.name,
    description: storeBranding.tagline || undefined,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: storeBranding.colors.primary,
}

function brandingVariables(): React.CSSProperties {
  const { colors, fontFamily } = storeBranding
  return {
    "--font-sans": fontFamily,
    "--color-primary": colors.primary,
    "--color-primary-contrast": colors.primaryContrast,
    "--color-accent": colors.accent,
    "--color-bg": colors.background,
    "--color-surface": colors.surface,
    "--color-text": colors.text,
    "--color-muted": colors.muted,
    "--color-border": colors.border,
    "--color-danger": colors.danger,
  } as React.CSSProperties
}

/**
 * Root layout owns only the document shell (`<html>`/`<body>`) and locale
 * direction. The customer storefront chrome lives in `(store)/layout.tsx` and
 * the operations admin chrome in `admin/layout.tsx`, so neither leaks into the
 * other. See ADR-0013 and the Phase 6 admin notes.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dir = directionOf(locale)

  return (
    <html lang={locale} dir={dir} style={brandingVariables()}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  )
}
