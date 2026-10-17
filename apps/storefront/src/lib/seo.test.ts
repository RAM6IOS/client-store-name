import { describe, expect, it } from "vitest"
import { siteConfig } from "@/config/store"
import { canonicalUrl, languageAlternates, pageMetadata } from "./seo"

describe("canonicalUrl", () => {
  it("prefixes the site URL and normalizes the path", () => {
    expect(canonicalUrl("/products")).toBe(`${siteConfig.url}/products`)
    expect(canonicalUrl("products")).toBe(`${siteConfig.url}/products`)
  })
})

describe("languageAlternates", () => {
  it("produces one alternate per locale using the `lang` query", () => {
    expect(languageAlternates("/products")).toEqual({
      ar: "/products?lang=ar",
      fr: "/products?lang=fr",
    })
  })
})

describe("pageMetadata", () => {
  it("builds title, canonical, and language alternates", () => {
    const metadata = pageMetadata({
      title: "T-shirt",
      description: "A soft cotton tee",
      path: "/products/tee",
    })
    expect(metadata.alternates?.canonical).toBe(`${siteConfig.url}/products/tee`)
    expect(metadata.alternates?.languages).toEqual(languageAlternates("/products/tee"))
    expect(String(metadata.title)).toContain("T-shirt")
    expect(metadata.description).toBe("A soft cotton tee")
    expect(metadata.robots).toBeUndefined()
  })

  it("marks private pages as noindex", () => {
    const metadata = pageMetadata({ path: "/order-success/abc", noIndex: true })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.openGraph?.images).toBeUndefined()
  })

  it("passes through provided Open Graph images", () => {
    const metadata = pageMetadata({
      path: "/products/tee",
      images: ["https://cdn.example.com/tee.jpg"],
    })
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/tee.jpg"])
  })
})
