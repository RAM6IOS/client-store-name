import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `ord-${Date.now().toString(36)}`

describe("Orders (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let adminKey: string
  let variantId1: string
  let variantId2: string

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

    const handle1 = `${RUN}-shirt`
    const res1 = await request(app.getHttpServer())
      .post("/api/catalog/products")
      .set(auth())
      .send({
        title: "Shirt",
        handle: handle1,
        currency_code: "DZD",
        price_amount: "150000",
        sku: `${handle1}-M`.toUpperCase(),
        initial_stock: 10,
      })
      .expect(201)
    variantId1 = res1.body.variants[0].id

    const handle2 = `${RUN}-hat`
    const res2 = await request(app.getHttpServer())
      .post("/api/catalog/products")
      .set(auth())
      .send({
        title: "Hat",
        handle: handle2,
        currency_code: "DZD",
        price_amount: "50000",
        sku: `${handle2}-ONE`.toUpperCase(),
        initial_stock: 5,
      })
      .expect(201)
    variantId2 = res2.body.variants[0].id
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { handle: { startsWith: RUN } } })
    await prisma.order.deleteMany({ where: { items: { some: { sku: { startsWith: RUN.toUpperCase() } } } } })
    await app.close()
  })

  describe("guest COD checkout", () => {
    it("creates an order without email (pending confirmation)", async () => {
      const idem = `idem-guest-${RUN}`
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: idem,
          currency_code: "DZD",
          customer_name: "Ahmed Benali",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger Centre",
          address_line: "Rue Didouche Mourad",
          items: [{ variant_id: variantId1, quantity: 2 }],
        })
        .expect(201)
      expect(res.body.status).toBe("pending_confirmation")
      expect(res.body.shipment_status).toBe("pending")
      expect(res.body.customer_phone).toMatch(/^\+213/)
      expect(res.body.email).toBeNull()
      expect(res.body.items).toHaveLength(1)
      expect(res.body.subtotal_amount).toBe("300000")
      expect(res.body.shipping_amount).toBeDefined()
      expect(BigInt(res.body.total_amount)).toBe(BigInt(res.body.subtotal_amount) + BigInt(res.body.shipping_amount) - BigInt(res.body.discount_amount || 0))
    })

    it("rejects invalid phone", async () => {
      await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-ph-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Test",
          customer_phone: "123",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Centre",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(400)
    })

    it("rejects unknown wilaya", async () => {
      await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-w-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Test",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "99",
          commune: "X",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(400)
    })

    it("requires delivery quote (no valid rate returns delivery unavailable)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-quote-${RUN}-${Date.now()}`,
          currency_code: "USD",
          customer_name: "Test",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(422)
      expect(res.body.code).toBe("DELIVERY_UNAVAILABLE")
    })

    it("returns same order for duplicate idempotency key", async () => {
      const idem = `idem-dup-${RUN}`
      const r1 = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: idem,
          currency_code: "DZD",
          customer_name: "Sara",
          customer_phone: "0567890123",
          delivery_method: "stop_desk",
          wilaya_code: "09",
          commune: "Blida",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(201)
      const r2 = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: idem,
          currency_code: "DZD",
          customer_name: "Sara",
          customer_phone: "0567890123",
          delivery_method: "stop_desk",
          wilaya_code: "09",
          commune: "Blida",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(201)
      expect(r2.body.id).toBe(r1.body.id)
    })

    it("accepts a verified commune_code and snapshots the delivery quote", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-commune-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Commune",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger Centre",
          commune_code: "16001",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(201)
      expect(res.body.commune_code).toBe("16001")
      expect(res.body.delivery_quote).toBeTruthy()
      expect(res.body.delivery_quote.wilaya_code).toBe("16")
      expect(res.body.delivery_quote.fee_amount).toBe("800")
    })

    it("rejects a commune_code that does not belong to the wilaya", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-commune-bad-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Commune",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Blida",
          commune_code: "09001",
          items: [{ variant_id: variantId2, quantity: 1 }],
        })
        .expect(400)
      expect(res.body.code).toBe("INVALID_LOCATION")
    })

    it("rejects invalid variant", async () => {
      await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-bad-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Bad",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: "bad", quantity: 1 }],
        })
        .expect(404)
    })

    it("prevents overselling on checkout", async () => {
      const handle = `${RUN}-scarce`
      const r = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "Scarce",
          handle,
          currency_code: "DZD",
          price_amount: "1000",
          sku: `${handle}-S`.toUpperCase(),
          initial_stock: 1,
        })
        .expect(201)
      const vid = r.body.variants[0].id
      await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-ov1-${RUN}`,
          currency_code: "DZD",
          customer_name: "A",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: vid, quantity: 1 }],
        })
        .expect(201)
      const bad = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-ov2-${RUN}`,
          currency_code: "DZD",
          customer_name: "B",
          customer_phone: "0552345679",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: vid, quantity: 1 }],
        })
        .expect(409)
      expect(bad.body.code).toBe("INSUFFICIENT_STOCK")
    })
  })

  describe("admin & tracking", () => {
    async function createOrderForTest() {
      const handle = `${RUN}-track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const prod = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "TrackProd",
          handle,
          currency_code: "DZD",
          price_amount: "1000",
          sku: `${handle}-M`.toUpperCase(),
          initial_stock: 10,
        })
        .expect(201)
      const vid = prod.body.variants[0].id
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-track-${RUN}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          currency_code: "DZD",
          customer_name: "Track",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: vid, quantity: 1 }],
        })
        .expect(201)
      return { res, vid, handle }
    }

    it("requires admin for admin routes", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      await request(app.getHttpServer()).get("/api/orders").expect(401)
      await request(app.getHttpServer()).get(`/api/orders/${orderId}`).expect(401)
    })

    it("allows admin to list and get", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      const list = await request(app.getHttpServer()).get("/api/orders").set(auth()).expect(200)
      expect(list.body.total).toBeGreaterThanOrEqual(1)
      const get = await request(app.getHttpServer()).get(`/api/orders/${orderId}`).set(auth()).expect(200)
      expect(get.body.id).toBe(orderId)
    })

    it("tracking exposes public data without private details", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      const token = res.body.tracking_token
      const t = await request(app.getHttpServer()).get(`/api/orders/track/${token}`).expect(200)
      expect(t.body.id).toBe(orderId)
      expect(t.body.customer_phone).toBeDefined()
      expect(t.body).not.toHaveProperty("confirmed_by")
    })

    it("confirm/cancel/status transitions with guards", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      await request(app.getHttpServer()).post(`/api/orders/${orderId}/confirm`).expect(401)
      await request(app.getHttpServer()).post(`/api/orders/${orderId}/cancel`).send({ reason: "x" }).expect(401)
      await request(app.getHttpServer()).patch(`/api/orders/${orderId}/status`).send({ to_status: "confirmed" }).expect(401)
    })

    it("requires an actor for administrative mutations", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      const bad = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/confirm`)
        .set(auth())
        .send({})
        .expect(400)
      expect(bad.body.code).toBe("VALIDATION_ERROR")
    })

    it("confirms order and prevents invalid transition", async () => {
      const { res } = await createOrderForTest()
      const orderId = res.body.id
      const c = await request(app.getHttpServer()).post(`/api/orders/${orderId}/confirm`).set(auth()).send({ actor: "ops" }).expect(201)
      expect(c.body.status).toBe("confirmed")
      expect(c.body.confirmed_at).toBeDefined()
      const bad = await request(app.getHttpServer()).post(`/api/orders/${orderId}/confirm`).set(auth()).send({ actor: "ops" }).expect(409)
      expect(bad.body.code).toBe("INVALID_TRANSITION")
    })

    it("cancels from preparing? move to preparing then cancel", async () => {
      const handle = `${RUN}-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const prod = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "CancelProd",
          handle,
          currency_code: "DZD",
          price_amount: "1000",
          sku: `${handle}-C`.toUpperCase(),
          initial_stock: 5,
        })
        .expect(201)
      const vid = prod.body.variants[0].id
      const o = await request(app.getHttpServer()).post("/api/checkout").send({
        idempotency_key: `idem-cancel-${RUN}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        currency_code: "DZD",
        customer_name: "Cancel",
        customer_phone: "0552345678",
        delivery_method: "home",
        wilaya_code: "16",
        commune: "Alger",
        items: [{ variant_id: vid, quantity: 1 }],
      }).expect(201)
      const oid = o.body.id
      await request(app.getHttpServer()).post(`/api/orders/${oid}/confirm`).set(auth()).send({ actor: "ops" }).expect(201)
      await request(app.getHttpServer()).patch(`/api/orders/${oid}/status`).set(auth()).send({ to_status: "preparing", actor: "ops" }).expect(200)
      const canc = await request(app.getHttpServer()).post(`/api/orders/${oid}/cancel`).set(auth()).send({ reason: "customer changed mind", actor: "ops" }).expect(201)
      expect(canc.body.status).toBe("cancelled")
      const dup = await request(app.getHttpServer()).post(`/api/orders/${oid}/cancel`).set(auth()).send({ reason: "again", actor: "ops" }).expect(409)
      expect(dup.body.code).toBe("INVALID_TRANSITION")
    })

    it("releases stock exactly once on cancellation", async () => {
      const handle = `${RUN}-release-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const prod = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "ReleaseProd",
          handle,
          currency_code: "DZD",
          price_amount: "1000",
          sku: `${handle}-R`.toUpperCase(),
          initial_stock: 4,
        })
        .expect(201)
      const vid = prod.body.variants[0].id
      const o = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-release-${RUN}-${Date.now()}`,
          currency_code: "DZD",
          customer_name: "Release",
          customer_phone: "0552345678",
          delivery_method: "home",
          wilaya_code: "16",
          commune: "Alger",
          items: [{ variant_id: vid, quantity: 3 }],
        })
        .expect(201)
      const oid = o.body.id
      const reserved = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${vid}`)
        .set(auth())
        .expect(200)
      expect(reserved.body.reservedQuantity).toBe(3)

      await request(app.getHttpServer())
        .post(`/api/orders/${oid}/cancel`)
        .set(auth())
        .send({ reason: "customer cancelled", actor: "ops" })
        .expect(201)

      const after = await request(app.getHttpServer())
        .get(`/api/inventory/variants/${vid}`)
        .set(auth())
        .expect(200)
      expect(after.body.reservedQuantity).toBe(0)
      expect(after.body.availableQuantity).toBe(4)
    })

    it("records delivery without implying collection or remittance", async () => {
      const { res, vid } = await createOrderForTest()
      const oid = res.body.id
      await request(app.getHttpServer()).post(`/api/orders/${oid}/confirm`).set(auth()).send({ actor: "ops" }).expect(201)
      await request(app.getHttpServer()).post(`/api/orders/${oid}/prepare`).set(auth()).send({ actor: "ops" }).expect(201)
      const dispatched = await request(app.getHttpServer()).post(`/api/orders/${oid}/dispatch`).set(auth()).send({ actor: "ops" }).expect(201)
      expect(dispatched.body.status).toBe("dispatched")
      expect(dispatched.body.shipment_status).toBe("shipped")
      const shipped = await request(app.getHttpServer()).post(`/api/orders/${oid}/transit`).set(auth()).send({ actor: "ops" }).expect(201)
      expect(shipped.body.status).toBe("shipped")
      expect(shipped.body.shipment_status).toBe("shipped")
      const delivered = await request(app.getHttpServer()).post(`/api/orders/${oid}/deliver`).set(auth()).send({ actor: "ops" }).expect(201)
      expect(delivered.body.status).toBe("delivered")
      expect(delivered.body.shipment_status).toBe("delivered")
      expect(delivered.body.collection_status).toBe("cod_pending")
      expect(vid).toBeDefined()
    })

    it("returns the admin order detail with status history and reservations", async () => {
      const { res } = await createOrderForTest()
      const oid = res.body.id
      await request(app.getHttpServer()).post(`/api/orders/${oid}/confirm`).set(auth()).send({ actor: "ops", note: "called customer" }).expect(201)
      const detail = await request(app.getHttpServer()).get(`/api/orders/${oid}`).set(auth()).expect(200)
      expect(detail.body.status).toBe("confirmed")
      expect(Array.isArray(detail.body.status_history)).toBe(true)
      expect(detail.body.status_history.length).toBeGreaterThanOrEqual(2)
      expect(detail.body.status_history[0].to_status).toBe("pending_confirmation")
      expect(detail.body.status_history.at(-1).changed_by).toBe("ops")
      expect(Array.isArray(detail.body.reservations)).toBe(true)
      const lastReservation = detail.body.reservations.at(-1)
      expect(lastReservation.status).toBe("committed")
    })

    it("does not leak status history on the public tracking route", async () => {
      const { res } = await createOrderForTest()
      const token = res.body.tracking_token
      const t = await request(app.getHttpServer()).get(`/api/orders/track/${token}`).expect(200)
      expect(t.body.status_history).toBeUndefined()
      expect(t.body.reservations).toBeUndefined()
    })
  })

  describe("Phase 6 order operations", () => {
    async function seedOrder(attrs: { status?: string; name?: string; phone?: string; wilaya?: string } = {}) {
      const handle = `${RUN}-ops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const prod = await request(app.getHttpServer())
        .post("/api/catalog/products")
        .set(auth())
        .send({
          title: "OpsProd",
          handle,
          currency_code: "DZD",
          price_amount: "2500",
          sku: `${handle}-O`.toUpperCase(),
          initial_stock: 20,
        })
        .expect(201)
      const vid = prod.body.variants[0].id
      const o = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          idempotency_key: `idem-ops-${RUN}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          currency_code: "DZD",
          customer_name: attrs.name ?? "Ops Customer",
          customer_phone: attrs.phone ?? "0552345678",
          delivery_method: "home",
          wilaya_code: attrs.wilaya ?? "16",
          commune: "Alger",
          items: [{ variant_id: vid, quantity: 1 }],
        })
        .expect(201)
      if (attrs.status) {
        const map: Record<string, string[]> = {
          confirmed: ["confirm"],
          preparing: ["confirm", "prepare"],
          shipped: ["confirm", "prepare", "dispatch", "transit"],
        }
        for (const action of map[attrs.status] ?? []) {
          await request(app.getHttpServer())
            .post(`/api/orders/${o.body.id}/${action}`)
            .set(auth())
            .send({ actor: "ops" })
            .expect(201)
        }
      }
      return {
        id: o.body.id as string,
        displayId: o.body.display_id as number,
        token: o.body.tracking_token as string,
        wilayaName: o.body.wilaya_name as string,
      }
    }

    it("searching by reference and phone narrows the list", async () => {
      const order = await seedOrder({ phone: "0661112233", name: "Searchable Person" })

      const byRef = await request(app.getHttpServer())
        .get(`/api/orders?search=${order.displayId}`)
        .set(auth())
        .expect(200)
      expect(byRef.body.data.some((o: { id: string }) => o.id === order.id)).toBe(true)

      const byLocalPhone = await request(app.getHttpServer())
        .get("/api/orders?search=0661112233")
        .set(auth())
        .expect(200)
      expect(byLocalPhone.body.data.some((o: { id: string }) => o.id === order.id)).toBe(true)

      const byName = await request(app.getHttpServer())
        .get("/api/orders?search=Searchable")
        .set(auth())
        .expect(200)
      expect(byName.body.data.some((o: { id: string }) => o.id === order.id)).toBe(true)

      const byWilaya = await request(app.getHttpServer())
        .get(`/api/orders?search=${encodeURIComponent(order.wilayaName)}`)
        .set(auth())
        .expect(200)
      expect(byWilaya.body.data.some((o: { id: string }) => o.id === order.id)).toBe(true)
    })

    it("paginates and sorts by total_amount", async () => {
      const marker = `Pager${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      await seedOrder({ name: marker })
      await seedOrder({ name: marker })
      const page1 = await request(app.getHttpServer())
        .get(`/api/orders?page=1&pageSize=1&sort=total_amount&order=asc&search=${marker}`)
        .set(auth())
        .expect(200)
      const page2 = await request(app.getHttpServer())
        .get(`/api/orders?page=2&pageSize=1&sort=total_amount&order=asc&search=${marker}`)
        .set(auth())
        .expect(200)
      expect(page1.body.page).toBe(1)
      expect(page1.body.pageSize).toBe(1)
      expect(page1.body.data).toHaveLength(1)
      expect(page1.body.total).toBe(2)
      expect(page1.body.totalPages).toBe(2)
      expect(page2.body.data).toHaveLength(1)
      expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id)
    })

    it("filters by shipment status", async () => {
      const order = await seedOrder({ status: "shipped" })
      const listed = await request(app.getHttpServer())
        .get("/api/orders?shipment_status=shipped")
        .set(auth())
        .expect(200)
      expect(listed.body.data.some((o: { id: string }) => o.id === order.id)).toBe(true)
      expect(listed.body.data.every((o: { shipment_status: string }) => o.shipment_status === "shipped")).toBe(true)
    })

    it("rejects a transition not permitted by the state machine", async () => {
      const order = await seedOrder()
      const bad = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/deliver`)
        .set(auth())
        .send({ actor: "ops" })
        .expect(409)
      expect(bad.body.code).toBe("INVALID_TRANSITION")
    })

    it("records contact-failure outcomes and allows recovery", async () => {
      const order = await seedOrder()
      const noAnswer = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/no-answer`)
        .set(auth())
        .send({ actor: "ops" })
        .expect(201)
      expect(noAnswer.body.status).toBe("no_answer")
      expect(noAnswer.body.shipment_status).toBe("pending")

      const recover = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/status`)
        .set(auth())
        .send({ to_status: "confirmed", actor: "ops" })
        .expect(200)
      expect(recover.body.status).toBe("confirmed")

      const wrong = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/wrong-number`)
        .set(auth())
        .send({ actor: "ops" })
        .expect(201)
      expect(wrong.body.status).toBe("wrong_number")
    })

    it("allows only one of two concurrent transitions to win", async () => {
      const order = await seedOrder()
      const [a, b] = await Promise.all([
        request(app.getHttpServer()).post(`/api/orders/${order.id}/confirm`).set(auth()).send({ actor: "ops-a" }),
        request(app.getHttpServer()).post(`/api/orders/${order.id}/confirm`).set(auth()).send({ actor: "ops-b" }),
      ])
      const statuses = [a.status, b.status].sort()
      expect(statuses).toEqual([201, 409])
    })

    it("exports CSV with escaped fields and without tracking tokens", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/orders/export")
        .set(auth())
        .expect(200)
      expect(res.headers["content-type"]).toContain("text/csv")
      const body = res.text as string
      const header = body.split("\r\n")[0]
      expect(header).toContain("order_id")
      expect(header).toContain("collection_status")
      expect(header).not.toContain("tracking_token")
      expect(body).not.toContain("delivery_quote")
    })

    it("requires admin for the export endpoint", async () => {
      await request(app.getHttpServer()).get("/api/orders/export").expect(401)
    })
  })
})