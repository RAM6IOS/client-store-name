import { cookies } from "next/headers"
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales"

/**
 * Resolves the active locale from the `locale` cookie (set by middleware from
 * `?lang=` or the switcher). Reading cookies makes layouts/pages dynamic, which
 * is intended: the storefront always reflects live catalog data, never a build
 * snapshot.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return resolveLocale(store.get(LOCALE_COOKIE)?.value)
}
