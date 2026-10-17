import { describe, expect, it } from "vitest"
import { dictionaries } from "./i18n/dictionaries"
import { interpolate, translate } from "./i18n"
import { DEFAULT_LOCALE, directionOf, isLocale, resolveLocale } from "./i18n/locales"

describe("dictionaries", () => {
  it("defines the same keys for Arabic and French", () => {
    const ar = Object.keys(dictionaries.ar).sort()
    const fr = Object.keys(dictionaries.fr).sort()
    expect(fr).toEqual(ar)
    expect(ar.length).toBeGreaterThan(0)
  })

  it("has no empty translations", () => {
    for (const locale of ["ar", "fr"] as const) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("")
      }
    }
  })
})

describe("interpolate", () => {
  it("replaces provided variables", () => {
    expect(interpolate("Hello {name}, {count} items", { name: "Sam", count: 2 })).toBe(
      "Hello Sam, 2 items",
    )
  })

  it("leaves unknown placeholders intact and passes through without vars", () => {
    expect(interpolate("Hello {name}")).toBe("Hello {name}")
    expect(interpolate("Hello {name}", { other: "x" })).toBe("Hello {name}")
  })
})

describe("translate", () => {
  it("returns localized strings and falls back to the default locale", () => {
    expect(translate("fr", "nav.products")).toBe(dictionaries.fr["nav.products"])
    expect(translate("de", "nav.products")).toBe(dictionaries[DEFAULT_LOCALE]["nav.products"])
    expect(translate(null, "nav.products")).toBe(dictionaries[DEFAULT_LOCALE]["nav.products"])
  })
})

describe("locale helpers", () => {
  it("narrows and resolves locale values", () => {
    expect(isLocale("ar")).toBe(true)
    expect(isLocale("en")).toBe(false)
    expect(resolveLocale("fr")).toBe("fr")
    expect(resolveLocale("en")).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE)
  })

  it("maps direction", () => {
    expect(directionOf("ar")).toBe("rtl")
    expect(directionOf("fr")).toBe("ltr")
  })
})
