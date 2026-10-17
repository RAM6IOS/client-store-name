"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { createTranslator, getDictionary, type Dictionary, type Translate } from "."
import { directionOf, type Locale } from "./locales"

interface I18nValue {
  locale: Locale
  dir: "rtl" | "ltr"
  t: Translate
  dict: Dictionary
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({ locale, dir: directionOf(locale), t: createTranslator(locale), dict: getDictionary(locale) }),
    [locale],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used within an I18nProvider")
  return value
}

export function useTranslate(): Translate {
  return useI18n().t
}
