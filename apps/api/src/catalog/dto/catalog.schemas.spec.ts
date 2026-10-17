import {
  createProductSchema,
  listProductsQuerySchema,
  normalizeSku,
  updateProductSchema,
  updateVariantSchema,
} from "./catalog.schemas"
import {
  adjustStockSchema,
  releaseStockSchema,
  reserveStockSchema,
} from "../../inventory/dto/inventory.schemas"

describe("catalog schemas", () => {
  describe("createProductSchema", () => {
    it("accepts a simple product with minor-unit price", () => {
      const result = createProductSchema.parse({
        title: "Cotton T-Shirt",
        currency_code: "dzd",
        price_amount: "150000",
        sku: "tee-blk-m",
        initial_stock: 25,
      })

      expect(result.currency_code).toBe("DZD")
      expect(result.price_amount).toBe(150000n)
      expect(result.sku).toBe("TEE-BLK-M")
    })

    it("accepts a simple product with a decimal price", () => {
      const result = createProductSchema.parse({
        title: "Mug",
        currency_code: "DZD",
        price: "1500.50",
      })
      expect(result.price).toBe("1500.50")
    })

    it("requires a price and currency for simple products", () => {
      const missingPrice = createProductSchema.safeParse({
        title: "No price",
        currency_code: "DZD",
      })
      expect(missingPrice.success).toBe(false)

      const missingCurrency = createProductSchema.safeParse({
        title: "No currency",
        price_amount: "100",
      })
      expect(missingCurrency.success).toBe(false)
    })

    it("rejects negative and non-integer prices", () => {
      expect(
        createProductSchema.safeParse({ title: "x", currency_code: "DZD", price_amount: "-1" })
          .success,
      ).toBe(false)
      expect(
        createProductSchema.safeParse({ title: "x", currency_code: "DZD", price_amount: "1.5" })
          .success,
      ).toBe(false)
      expect(
        createProductSchema.safeParse({ title: "x", currency_code: "DZD", price: "-5.00" }).success,
      ).toBe(false)
      expect(
        createProductSchema.safeParse({ title: "x", currency_code: "DZD", price: "abc" }).success,
      ).toBe(false)
    })

    it("rejects invalid stock quantities", () => {
      expect(
        createProductSchema.safeParse({
          title: "x",
          currency_code: "DZD",
          price_amount: "1",
          initial_stock: -1,
        }).success,
      ).toBe(false)
      expect(
        createProductSchema.safeParse({
          title: "x",
          currency_code: "DZD",
          price_amount: "1",
          initial_stock: 1.5,
        }).success,
      ).toBe(false)
    })

    it("accepts a variant product, falling back to the product currency", () => {
      const result = createProductSchema.parse({
        title: "Shirt",
        currency_code: "DZD",
        variants: [
          { title: "Small", price_amount: "1000", sku: "shirt-s" },
          { title: "Medium", price: "20.00", currency_code: "usd" },
        ],
      })

      expect(result.variants).toHaveLength(2)
      expect(result.variants?.[1].currency_code).toBe("USD")
    })

    it("rejects variants with no resolvable currency", () => {
      const result = createProductSchema.safeParse({
        title: "Shirt",
        variants: [{ title: "Small", price_amount: "1000" }],
      })
      expect(result.success).toBe(false)
    })

    it("accepts a per-variant compare-at price, including an explicit null", () => {
      const result = createProductSchema.parse({
        title: "Shirt",
        currency_code: "DZD",
        variants: [
          { title: "Small", price_amount: "1000", compare_at_amount: "1500" },
          { title: "Medium", price: "20.00", compare_at_price: "25.00" },
          { title: "Large", price_amount: "3000", compare_at_amount: null },
        ],
      })

      expect(result.variants?.[0].compare_at_amount).toBe(1500n)
      expect(result.variants?.[1].compare_at_price).toBe("25.00")
      expect(result.variants?.[2].compare_at_amount).toBe(null)
    })

    it("rejects a malformed per-variant compare-at price", () => {
      expect(
        createProductSchema.safeParse({
          title: "Shirt",
          currency_code: "DZD",
          variants: [{ title: "Small", price_amount: "1000", compare_at_price: "free" }],
        }).success,
      ).toBe(false)
    })

    it("accepts an optional featured flag", () => {
      const featured = createProductSchema.parse({
        title: "x",
        currency_code: "DZD",
        price: "1.00",
        is_featured: true,
      })
      expect(featured.is_featured).toBe(true)

      const unflagged = createProductSchema.parse({
        title: "x",
        currency_code: "DZD",
        price: "1.00",
      })
      expect(unflagged.is_featured).toBeUndefined()
    })
  })

  describe("update schemas", () => {
    it("reject empty payloads", () => {
      expect(updateProductSchema.safeParse({}).success).toBe(false)
      expect(updateVariantSchema.safeParse({}).success).toBe(false)
    })

    it("accept a partial update", () => {
      expect(updateProductSchema.parse({ status: "published" }).status).toBe("published")
    })

    it("accepts compare-at as decimal or minor units", () => {
      expect(updateProductSchema.parse({ compare_at_price: "29.99" }).compare_at_price).toBe("29.99")
      expect(updateProductSchema.parse({ compare_at_amount: "2999" }).compare_at_amount).toBe(2999n)
    })

    it("accepts an explicit null to clear compare-at", () => {
      expect(updateProductSchema.parse({ compare_at_price: null }).compare_at_price).toBe(null)
      expect(updateProductSchema.parse({ compare_at_amount: null }).compare_at_amount).toBe(null)
    })

    it("rejects malformed compare-at values", () => {
      expect(updateProductSchema.safeParse({ compare_at_price: "free" }).success).toBe(false)
      expect(updateProductSchema.safeParse({ compare_at_price: "-5.00" }).success).toBe(false)
      expect(updateProductSchema.safeParse({ compare_at_amount: "1.5" }).success).toBe(false)
      expect(updateProductSchema.safeParse({ compare_at_amount: "-1" }).success).toBe(false)
    })

    it("accepts an explicit featured flag to set or clear it", () => {
      expect(updateProductSchema.parse({ is_featured: true }).is_featured).toBe(true)
      expect(updateProductSchema.parse({ is_featured: false }).is_featured).toBe(false)
      expect(updateProductSchema.parse({ status: "draft" }).is_featured).toBeUndefined()
    })
  })

  describe("listProductsQuerySchema", () => {
    it("coerces the featured query flag", () => {
      expect(listProductsQuerySchema.parse({ featured: "true" }).featured).toBe(true)
      expect(listProductsQuerySchema.parse({ featured: "false" }).featured).toBe(false)
      expect(listProductsQuerySchema.parse({ featured: true }).featured).toBe(true)
      expect(listProductsQuerySchema.parse({}).featured).toBeUndefined()
    })
  })

  describe("inventory schemas", () => {
    it("reject zero and non-integer adjustment quantities", () => {
      expect(adjustStockSchema.safeParse({ quantity: 0 }).success).toBe(false)
      expect(adjustStockSchema.safeParse({ quantity: 1.5 }).success).toBe(false)
    })

    it("reject negative quantities for receipts and returns", () => {
      expect(adjustStockSchema.safeParse({ quantity: -5, type: "receipt" }).success).toBe(false)
      expect(adjustStockSchema.safeParse({ quantity: -5, type: "return" }).success).toBe(false)
    })

    it("allow negative adjustment deltas", () => {
      const result = adjustStockSchema.parse({ quantity: -5, type: "adjustment" })
      expect(result.quantity).toBe(-5)
    })

    it("require strictly positive reserve/release quantities", () => {
      expect(reserveStockSchema.safeParse({ quantity: 0 }).success).toBe(false)
      expect(reserveStockSchema.safeParse({ quantity: -1 }).success).toBe(false)
      expect(reserveStockSchema.parse({ quantity: 3 }).quantity).toBe(3)
      expect(releaseStockSchema.safeParse({ quantity: 0 }).success).toBe(false)
    })
  })

  describe("normalizeSku", () => {
    it("trims and upper-cases", () => {
      expect(normalizeSku("  ab-12 ")).toBe("AB-12")
    })
  })
})
