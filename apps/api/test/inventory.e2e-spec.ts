import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `inv-${Date.now().toString(36)}`

describe("Inventory (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let adminKey: string
  let counter = 0

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
    await prisma.product.deleteMany({ where: { handle: { startsWith: RUN } } })
    await app.close()
  })

  async function createVariantWithStock(stock: number, label: string): Promise<string> {
    const handle = `${RUN}-${label}-${counter++}`
    const response = await request(app.getHttpServer())
      .post("/api/catalog/products")
      .set(auth())
      .send({
        title: label,
        handle,
        currency_code: "DZD",
        price_amount: "1000",
        sku: `${handle}-SKU`,
        initial_stock: stock,
      })
      .expect(201)
    return response.body.variants[0].id as string
  }

  describe("queries", () => {
    it("requires authentication for mutations", async () => {
      const variantId = await createVariantWithStock(1, "auth")
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .send({ quantity: 1 })
        .expect(401)
    })

    it("reports availability", async () => {
      const variantId = await createVariantWithStock(7, "avail")
      const response = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${variantId}`)
        .expect(200)
      expect(response.body.stockedQuantity).toBe(7)
      expect(response.body.reservedQuantity).toBe(0)
      expect(response.body.availableQuantity).toBe(7)
    })

    it("returns 404 for a variant without an inventory item", async () => {
      await request(app.getHttpServer()).get("/api/inventory/variants/nope").expect(404)
    })

    it("records an initial receipt movement in the ledger", async () => {
      const variantId = await createVariantWithStock(4, "ledger")
      const response = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${variantId}/movements`)
        .expect(200)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].type).toBe("receipt")
      expect(response.body.data[0].stocked_after).toBe(4)
    })
  })

  describe("reserve / release", () => {
    it("reserves stock and rejects over-reservation", async () => {
      const variantId = await createVariantWithStock(2, "reserve")

      const reserved = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/reserve`)
        .set(auth())
        .send({ quantity: 2, reference: "test-order-1" })
        .expect(201)
      expect(reserved.body.reservedQuantity).toBe(2)
      expect(reserved.body.availableQuantity).toBe(0)

      const over = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/reserve`)
        .set(auth())
        .send({ quantity: 1 })
        .expect(409)
      expect(over.body.code).toBe("INSUFFICIENT_STOCK")
    })

    it("releases reserved stock and rejects over-release", async () => {
      const variantId = await createVariantWithStock(3, "release")
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/reserve`)
        .set(auth())
        .send({ quantity: 2 })
        .expect(201)

      const released = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/release`)
        .set(auth())
        .send({ quantity: 1 })
        .expect(201)
      expect(released.body.reservedQuantity).toBe(1)

      const overRelease = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/release`)
        .set(auth())
        .send({ quantity: 5 })
        .expect(400)
      expect(overRelease.body.code).toBe("INVALID_STOCK")
    })
  })

  describe("adjustments", () => {
    it("applies receipts and negative adjustments", async () => {
      const variantId = await createVariantWithStock(0, "adjust")

      const receipt = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .set(auth())
        .send({ quantity: 10, type: "receipt" })
        .expect(201)
      expect(receipt.body.stockedQuantity).toBe(10)

      const removed = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .set(auth())
        .send({ quantity: -4, type: "adjustment", reason: "damaged" })
        .expect(201)
      expect(removed.body.stockedQuantity).toBe(6)
    })

    it("rejects adjustments that would make stocked negative", async () => {
      const variantId = await createVariantWithStock(1, "negative")
      const response = await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .set(auth())
        .send({ quantity: -5, type: "adjustment" })
        .expect(400)
      expect(response.body.code).toBe("INVALID_STOCK")
    })

    it("rejects adjustments that would drop stock below reserved", async () => {
      const variantId = await createVariantWithStock(5, "below-reserved")
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/reserve`)
        .set(auth())
        .send({ quantity: 4 })
        .expect(201)

      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .set(auth())
        .send({ quantity: -3, type: "adjustment" })
        .expect(400)
    })
  })

  describe("concurrency", () => {
    it("prevents overselling: N concurrent reservations for the last unit -> exactly one wins", async () => {
      const variantId = await createVariantWithStock(1, "race-reserve")

      const attempts = 8
      const responses = await Promise.all(
        Array.from({ length: attempts }, (_, index) =>
          request(app.getHttpServer())
            .post(`/api/inventory/variants/${variantId}/reserve`)
            .set(auth())
            .send({ quantity: 1, reference: `race-${index}` }),
        ),
      )

      const successes = responses.filter((response) => response.status === 201)
      const conflicts = responses.filter((response) => response.status === 409)

      expect(successes).toHaveLength(1)
      expect(conflicts).toHaveLength(attempts - 1)

      const availability = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${variantId}`)
        .expect(200)
      expect(availability.body.reservedQuantity).toBe(1)
      expect(availability.body.availableQuantity).toBe(0)
      expect(availability.body.stockedQuantity).toBe(1)
    })

    it("preserves the stocked invariant under concurrent decrements", async () => {
      const variantId = await createVariantWithStock(10, "race-adjust")

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(app.getHttpServer())
            .post(`/api/inventory/variants/${variantId}/adjust`)
            .set(auth())
            .send({ quantity: -3, type: "adjustment", reference: `adj-${index}` }),
        ),
      )

      const successes = responses.filter((response) => response.status === 201)
      const rejections = responses.filter((response) => response.status === 400)

      expect(successes).toHaveLength(3)
      expect(rejections).toHaveLength(3)

      const availability = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${variantId}`)
        .expect(200)
      expect(availability.body.stockedQuantity).toBe(1)
      expect(availability.body.stockedQuantity).toBeGreaterThanOrEqual(0)
    })

    it("keeps the movement ledger consistent with the counters", async () => {
      const variantId = await createVariantWithStock(5, "ledger-consistency")
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/reserve`)
        .set(auth())
        .send({ quantity: 2 })
        .expect(201)
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/release`)
        .set(auth())
        .send({ quantity: 1 })
        .expect(201)
      await request(app.getHttpServer())
        .post(`/api/inventory/variants/${variantId}/adjust`)
        .set(auth())
        .send({ quantity: 3, type: "receipt" })
        .expect(201)

      const movements = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${variantId}/movements`)
        .expect(200)

      const stockedDelta = movements.body.data.reduce(
        (sum: number, movement: { stocked_delta: number }) => sum + movement.stocked_delta,
        0,
      )
      const reservedDelta = movements.body.data.reduce(
        (sum: number, movement: { reserved_delta: number }) => sum + movement.reserved_delta,
        0,
      )

      expect(stockedDelta).toBe(8)
      expect(reservedDelta).toBe(1)
    })
  })
})
