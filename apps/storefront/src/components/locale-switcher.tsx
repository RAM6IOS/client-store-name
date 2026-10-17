"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { LOCALES, LOCALE_LABELS, LOCALE_QUERY_PARAM, type Locale } from "@/lib/i18n/locales"
import { useTranslate } from "@/lib/i18n/context"

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslate()

  function hrefFor(target: Locale): string {
    const params = new URLSearchParams(searchParams.toString())
    params.set(LOCALE_QUERY_PARAM, target)
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  return (
    <div className="locale-switch" role="group" aria-label={t("nav.language")}>
      {LOCALES.map((target) => (
        // A plain anchor (not `next/link`) forces a full document navigation.
        // The locale lives in a cookie read by the root layout, which Next does
        // not re-render on client-side search-param navigation; without a full
        // reload the client `I18nProvider` keeps the previous language.
        <a
          key={target}
          href={hrefFor(target)}
          hrefLang={target}
          aria-current={target === locale ? "true" : undefined}
          title={LOCALE_LABELS[target].native}
        >
          {target.toUpperCase()}
        </a>
      ))}
    </div>
  )
}
