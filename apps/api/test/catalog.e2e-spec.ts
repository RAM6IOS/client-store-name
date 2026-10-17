import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `it-${Date.now().toString(36)}`

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const AVIF = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x1c]),
  Buffer.from("ftyp"),
  Buffer.from("avif"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("avif"),
  Buffer.from("mif1"),
])

describe("Catalog (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let adminKey: string

  const auth = () => ({ "x-admin-api-key": adminKey })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    prisma = app.get(PrismaService)
    adminKey = app.get(ConfigService).get<string>("ADMIN_API_KEY") ?? "test-admin-key"

    await prisma.currency.upsert({
      where: { code: "DZD" },
      update: { minor_digits: 2, is_active: true },
      create: { code: "DZD", name: "Algerian Dinar", minor_digits: 2, is_active: true },
    })
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { items: { some: { sku: { startsWith: RUN.toUpperCase() } } } } })
    await prisma.product.deleteMany({ where: { handle: { startsWith: RUN } } })
    await prisma.category.deleteMany({ where: { slug: { startsWith: RUN } } })
    await app.close()
  })

  describe("authorization", () => {
    it("rejects anonymous mutations with 401", async () => {
      await request(app.getHttpServer())
        .post("/api/catalog/products")
        .send({ title: "Nope", currency_code: "DZD", price_amount: "1" })
        .expect(401)
    })

    it("rejects mutations with a wrong key", async () => {
      await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set("x-admin-api-key", "wrong-key")
        .send({ title: "Nope", currency_code: "DZD", price_amount: "1" })
        .expect(401)
    })
  })

  describe("simple product lifecycle", () => {
    const handle = `${RUN}-simple`
    const sku = `${RUN}-SKU-SIMPLE`.toUpperCase()
    let productId: string
    let variantId: string

    it("creates a simple product with an auto default variant + inventory", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Simple Product",
          handle,
          currency_code: "DZD",
          price_amount: "150000",
          sku,
          initial_stock: 5,
        })
        .expect(201)

      expect(response.body.handle).toBe(handle)
      expect(response.body.status).toBe("draft")
      expect(response.body.variants).toHaveLength(1)
      expect(response.body.variants[0].is_default).toBe(true)
      expect(response.body.variants[0].sku).toBe(sku)
      expect(response.body.variants[0].price_amount).toBe("150000")
      expect(response.body.variants[0].inventory_item.stocked_quantity).toBe(5)

      productId = response.body.id
      variantId = response.body.variants[0].id
    })

    it("rejects a duplicate SKU with 409 DUPLICATE_SKU", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Dup",
          handle: `${RUN}-dup`,
          currency_code: "DZD",
          price_amount: "100",
          sku,
        })
        .expect(409)

      expect(response.body.code).toBe("DUPLICATE_SKU")
    })

    it("rejects an invalid price with 400", async () => {
      await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "BadPrice",
          handle: `${RUN}-badprice`,
          currency_code: "DZD",
          price_amount: "-1",
        })
        .expect(400)

      await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "BadPrice2",
          handle: `${RUN}-badprice2`,
          currency_code: "DZD",
          price: "-5.00",
        })
        .expect(400)
    })

    it("rejects an invalid stock quantity with 400", async () => {
      await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "BadStock",
          handle: `${RUN}-badstock`,
          currency_code: "DZD",
          price_amount: "100",
          initial_stock: -1,
        })
        .expect(400)
    })

    it("rejects an unknown currency with 400 UNKNOWN_CURRENCY", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "BadCurrency",
          handle: `${RUN}-badcur`,
          currency_code: "XYZ",
          price_amount: "100",
        })
        .expect(400)
      expect(response.body.code).toBe("UNKNOWN_CURRENCY")
    })

    it("retrieves a product by id", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/catalog/products/${productId}`)
        .expect(200)
      expect(response.body.id).toBe(productId)
    })

    it("returns 404 for an unknown product", async () => {
      await request(app.getHttpServer()).get("/api/catalog/products/does-not-exist").expect(404)
    })

    it("lists products filtered by search", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/catalog/products")
        .query({ search: handle })
        .expect(200)
      expect(response.body.total).toBeGreaterThanOrEqual(1)
      expect(response.body.data.some((p: { id: string }) => p.id === productId)).toBe(true)
    })

    it("lists products filtered by variant SKU", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/catalog/products")
        .query({ search: sku })
        .expect(200)
      expect(response.body.data.some((p: { id: string }) => p.id === productId)).toBe(true)
    })

    it("updates a product", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/catalog/products/${productId}`)
        .set(auth())
        .send({ status: "published", title: "Simple Product v2" })
        .expect(200)
      expect(response.body.status).toBe("published")
      expect(response.body.title).toBe("Simple Product v2")
    })

    it("updates a variant price", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/catalog/variants/${variantId}`)
        .set(auth())
        .send({ price_amount: "200000" })
        .expect(200)
      const variant = response.body.variants.find((v: { id: string }) => v.id === variantId)
      expect(variant.price_amount).toBe("200000")
    })

    it("adds a second variant", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/catalog/products/${productId}/variants`)
        .set(auth())
        .send({
          title: "Large",
          sku: `${RUN}-SKU-LARGE`,
          currency_code: "DZD",
          price_amount: "160000",
        })
        .expect(201)
      expect(response.body.sku).toBe(`${RUN}-SKU-LARGE`.toUpperCase())
      expect(response.body.inventory_item.stocked_quantity).toBe(0)
    })
  })

  describe("variant product", () => {
    const handle = `${RUN}-variant`

    it("creates a product with multiple variants", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Variant Product",
          handle,
          currency_code: "DZD",
          variants: [
            { title: "Small", sku: `${RUN}-SKU-VS`, price_amount: "1000", initial_stock: 3 },
            { title: "Medium", sku: `${RUN}-SKU-VM`, price: "12.50" },
          ],
        })
        .expect(201)

      expect(response.body.variants).toHaveLength(2)
      const medium = response.body.variants.find((v: { title: string }) => v.title === "Medium")
      expect(medium.price_amount).toBe("1250")
    })

    it("deletes the product and cascades variants", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "To Delete",
          handle: `${RUN}-delete`,
          currency_code: "DZD",
          price_amount: "1",
        })
        .expect(201)

      await request(app.getHttpServer())
        .delete(`/api/catalog/products/${created.body.id}`)
        .set(auth())
        .expect(200)

      await request(app.getHttpServer()).get(`/api/catalog/products/${created.body.id}`).expect(404)
    })
  })

  describe("product images", () => {
    const handle = `${RUN}-images`
    let productId: string

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Imaged Product",
          handle,
          currency_code: "DZD",
          price_amount: "500",
        })
        .expect(201)
      productId = created.body.id
    })

    it("uploads JPEG and AVIF files and serves them with the right content type", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/catalog/products/${productId}/images/upload`)
        .set(auth())
        .attach("files", JPEG, "front.jpg")
        .attach("files", AVIF, "back.avif")
        .expect(201)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body).toHaveLength(2)

      const [jpegImage, avifImage] = response.body
      expect(jpegImage.url).toMatch(/\/api\/media\/products\/.+\.jpg$/)
      expect(avifImage.url).toMatch(/\/api\/media\/products\/.+\.avif$/)

      const jpegPath = new URL(jpegImage.url).pathname
      const avifPath = new URL(avifImage.url).pathname

      await request(app.getHttpServer())
        .get(jpegPath)
        .expect("content-type", "image/jpeg")
        .expect(200)
      await request(app.getHttpServer())
        .get(avifPath)
        .expect("content-type", "image/avif")
        .expect(200)
    })

    it("rejects non-image content with 400 INVALID_IMAGE", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/catalog/products/${productId}/images/upload`)
        .set(auth())
        .attach("files", Buffer.from("just some text"), "evil.png")
        .expect(400)
      expect(response.body.code).toBe("INVALID_IMAGE")
    })

    it("deletes a stored image", async () => {
      const uploaded = await request(app.getHttpServer())
        .post(`/api/catalog/products/${productId}/images/upload`)
        .set(auth())
        .attach("files", JPEG, "delete-me.jpg")
        .expect(201)

      const imageId = uploaded.body[0].id
      await request(app.getHttpServer())
        .delete(`/api/catalog/images/${imageId}`)
        .set(auth())
        .expect(200)

      const product = await request(app.getHttpServer())
        .get(`/api/catalog/products/${productId}`)
        .expect(200)
      expect(product.body.images.some((image: { id: string }) => image.id === imageId)).toBe(false)
    })
  })

  describe("order-history guard", () => {
    const handle = `${RUN}-ordered`
    let productId: string
    let variantId: string
    let rateId: string

    it("blocks deletion of a product once it appears in order history", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Ordered Product",
          handle,
          currency_code: "DZD",
          price_amount: "1000",
          sku: `${RUN}-ORDERED`.toUpperCase(),
          initial_stock: 3,
        })
        .expect(201)
      productId = created.body.id
      variantId = created.body.variants[0].id

      const rate = await prisma.deliveryRate.upsert({
        where: {
          wilaya_code_method_currency_code_provider: {
            wilaya_code: "31",
            method: "home",
            currency_code: "DZD",
            provider: "",
          },
        },
        update: { is_active: true, fee_amount: BigInt(500), label: null },
        create: {
          wilaya_code: "31",
          method: "home",
          currency_code: "DZD",
          provider: "",
          fee_amount: BigInt(500),
        },
      })
      rateId = rate.id

      await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-history-${RUN}`,
          currency_code: "DZD",
          customer_name: "History Test",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "31",
          commune: "Oran",
          address_line: "Rue d'Oran",
          items: [{ variant_id: variantId, quantity: 1 }],
        })
        .expect(201)

      const productDelete = await request(app.getHttpServer())
        .delete(`/api/catalog/products/${productId}`)
        .set(auth())
        .expect(409)
      expect(productDelete.body.code).toBe("HISTORY_EXISTS")

      const variantDelete = await request(app.getHttpServer())
        .delete(`/api/catalog/variants/${variantId}`)
        .set(auth())
        .expect(409)
      expect(variantDelete.body.code).toBe("HISTORY_EXISTS")

      await request(app.getHttpServer()).get(`/api/catalog/products/${productId}`).expect(200)
    })

    afterAll(async () => {
      if (rateId) {
        await prisma.order.deleteMany({
          where: { items: { some: { sku: `${RUN}-ORDERED` } } },
        })
        await prisma.deliveryRate.deleteMany({ where: { id: rateId } })
      }
    })
  })

  describe("categories", () => {
    const slug = `${RUN}-cat`
    let categoryId: string

    it("creates a category", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/categories")
        .set(auth())
        .send({ name: "Tops", slug })
        .expect(201)
      expect(response.body.slug).toBe(slug)
      categoryId = response.body.id
    })

    it("rejects a duplicate slug with 409 DUPLICATE_SLUG", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/categories")
        .set(auth())
        .send({ name: "Tops again", slug })
        .expect(409)
      expect(response.body.code).toBe("DUPLICATE_SLUG")
    })

    it("lists, reads and updates the category", async () => {
      await request(app.getHttpServer()).get("/api/catalog/categories").expect(200)
      await request(app.getHttpServer()).get(`/api/catalog/categories/${categoryId}`).expect(200)
      const updated = await request(app.getHttpServer())
        .patch(`/api/catalog/categories/${categoryId}`)
        .set(auth())
        .send({ position: 5 })
        .expect(200)
      expect(updated.body.position).toBe(5)
    })

    it("assigns a product to a category and filters by it", async () => {
      const product = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Categorised",
          handle: `${RUN}-categorised`,
          currency_code: "DZD",
          price_amount: "100",
          categories: [{ category_id: categoryId }],
        })
        .expect(201)
      expect(product.body.categories[0].category_id).toBe(categoryId)

      const filtered = await request(app.getHttpServer())
        .get("/api/catalog/products")
        .query({ category: slug })
        .expect(200)
      expect(filtered.body.data.some((p: { id: string }) => p.id === product.body.id)).toBe(true)
    })

    it("deletes the category", async () => {
      await request(app.getHttpServer())
        .delete(`/api/catalog/categories/${categoryId}`)
        .set(auth())
        .expect(200)
      await request(app.getHttpServer()).get(`/api/catalog/categories/${categoryId}`).expect(404)
    })
  })

  describe("product options and variant combination generation", () => {
    const handle = `${RUN}-options`
    let productId: string

    it("generates cartesian product variants automatically when creating product with options", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Shoes",
          handle,
          currency_code: "DZD",
          price_amount: "500000",
          initial_stock: 10,
          options: [
            {
              title: "Color",
              values: [{ value: "Red" }, { value: "Black" }],
            },
            {
              title: "Size",
              values: [{ value: "40" }, { value: "35" }],
            },
          ],
        })
        .expect(201)

      expect(response.body.options).toHaveLength(2)
      expect(response.body.variants).toHaveLength(4) // 2 colors * 2 sizes = 4 combinations
      expect(response.body.variants.some((v: { title: string }) => v.title === "Red / 40")).toBe(true)
      expect(response.body.variants.some((v: { title: string }) => v.title === "Black / 35")).toBe(true)
      productId = response.body.id
    })

    it("preserves variant price and stock when updating/regenerating options", async () => {
      // Get product and variant id for Red / 40
      const productBefore = await request(app.getHttpServer())
        .get(`/api/catalog/products/${productId}`)
        .expect(200)

      const red40 = productBefore.body.variants.find((v: { title: string }) => v.title === "Red / 40")
      expect(red40).toBeDefined()

      // Update Red / 40 price
      await request(app.getHttpServer())
        .patch(`/api/catalog/variants/${red40.id}`)
        .set(auth())
        .send({ price_amount: "600000" })
        .expect(200)

      // Update product options (e.g. keep Red and Black, but change Size to 40 and 42)
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/catalog/products/${productId}`)
        .set(auth())
        .send({
          options: [
            {
              title: "Color",
              values: [{ value: "Red" }, { value: "Black" }],
            },
            {
              title: "Size",
              values: [{ value: "40" }, { value: "42" }],
            },
          ],
        })
        .expect(200)

      expect(updateResponse.body.variants).toHaveLength(4)
      const newRed40 = updateResponse.body.variants.find((v: { title: string }) => v.title === "Red / 40")
      expect(newRed40).toBeDefined()
      // Price should be preserved as 600000
      expect(newRed40.price_amount).toBe("600000")

      // Red / 42 should be newly generated
      const red42 = updateResponse.body.variants.find((v: { title: string }) => v.title === "Red / 42")
      expect(red42).toBeDefined()
    })
  })
})
