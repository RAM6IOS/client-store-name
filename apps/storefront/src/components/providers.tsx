"use client"

import type { ReactNode } from "react"
import { I18nProvider } from "@/lib/i18n/context"
import type { Locale } from "@/lib/i18n/locales"
import { CartProvider } from "./cart-provider"

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider locale={locale}>
      <CartProvider>{children}</CartProvider>
    </I18nProvider>
  )
}
