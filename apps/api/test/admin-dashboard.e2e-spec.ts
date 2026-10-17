import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `adm-${Date.now().toString(36)}`

describe("Admin dashboard, customers and store settings (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService
  let adminKey: string
  let variantId: string
  let orderId: string
  let localPhone: string
  let e164Phone: string
  let customerName: string
  let originalStoreName: string

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

    const existingSettings = await prisma.storeSetting.findFirst()
    originalStoreName = existingSettings?.name ?? "Store"

    const handle = `${RUN}-prod`
    const prod = await request(app.getHttpServer())
      .post("/api/catalog/products")
      .set(auth())
      .send({
        title: "Admin Prod",
        handle,
        status: "published",
        currency_code: "DZD",
        price_amount: "100000",
        sku: `${handle}-M`.toUpperCase(),
        initial_stock: 20,
      })
      .expect(201)
    variantId = prod.body.variants[0].id

    localPhone = `05${String(Date.now() % 100000000).padStart(8, "0")}`
    e164Phone = `+213${localPhone.slice(1)}`
    customerName = `AdminCust-${RUN}`

    const first = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        idempotency_key: `idem-${RUN}-1`,
        currency_code: "DZD",
        customer_name: customerName,
        customer_phone: localPhone,
        delivery_method: "home",
        wilaya_code: "16",
        commune: "Alger",
        items: [{ variant_id: variantId, quantity: 1 }],
      })
      .expect(201)
    orderId = first.body.id

    await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        idempotency_key: `idem-${RUN}-2`,
        currency_code: "DZD",
        customer_name: customerName,
        customer_phone: localPhone,
        delivery_method: "home",
        wilaya_code: "16",
        commune: "Alger",
        items: [{ variant_id: variantId, quantity: 2 }],
      })
      .expect(201)
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { handle: { startsWith: RUN } } })
    await prisma.order.deleteMany({ where: { customer_phone: e164Phone } })
    const settings = await prisma.storeSetting.findFirst()
    if (settings) {
      await prisma.storeSetting.update({
        where: { id: settings.id },
        data: { name: originalStoreName },
      })
    }
    await app.close()
  })

  it("requires the admin key on every admin route", async () => {
    await request(app.getHttpServer()).get("/api/admin/dashboard").expect(401)
    await request(app.getHttpServer()).get("/api/admin/customers").expect(401)
    await request(app.getHttpServer()).get("/api/admin/store/settings").expect(401)
  })

  it("returns the dashboard overview reflecting placed orders", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set(auth())
      .expect(200)

    expect(typeof res.body.generated_at).toBe("string")
    expect(res.body.currency_code).toMatch(/^[A-Z]{3}$/)
    expect(res.body.orders.total).toBeGreaterThanOrEqual(2)
    expect(res.body.orders.by_status.pending_confirmation).toBeGreaterThanOrEqual(2)
    expect(typeof res.body.orders.placed_value).toBe("string")
    expect(BigInt(res.body.orders.placed_value)).toBeGreaterThanOrEqual(0n)
    expect(typeof res.body.orders.delivered_value).toBe("string")
    expect(res.body.customers.total).toBeGreaterThanOrEqual(1)
    expect(res.body.catalog.products_total).toBeGreaterThanOrEqual(1)
    expect(typeof res.body.catalog.low_stock).toBe("number")
    expect(Array.isArray(res.body.recent_orders)).toBe(true)
    expect(res.body.recent_orders.some((o: { id: string }) => o.id === orderId)).toBe(true)
    expect(Array.isArray(res.body.low_stock_items)).toBe(true)
  })

  it("derives customers from orders and searches by phone and name", async () => {
    const byPhone = await request(app.getHttpServer())
      .get(`/api/admin/customers?search=${encodeURIComponent(localPhone)}`)
      .set(auth())
      .expect(200)

    const customer = byPhone.body.data.find(
      (c: { phone: string }) => c.phone === e164Phone,
    )
    expect(customer).toBeTruthy()
    expect(customer.name).toBe(customerName)
    expect(customer.orders_count).toBe(2)
    expect(customer.delivered_count).toBe(0)
    expect(customer.cancelled_count).toBe(0)
    expect(customer.returned_count).toBe(0)
    expect(typeof customer.total_spent).toBe("string")

    const byName = await request(app.getHttpServer())
      .get(`/api/admin/customers?search=${encodeURIComponent(customerName)}`)
      .set(auth())
      .expect(200)
    expect(byName.body.data.some((c: { phone: string }) => c.phone === e164Phone)).toBe(true)
  })

  it("returns a customer detail with their orders", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/admin/customers/${encodeURIComponent(e164Phone)}`)
      .set(auth())
      .expect(200)

    expect(res.body.phone).toBe(e164Phone)
    expect(res.body.orders_count).toBe(2)
    expect(res.body.orders).toHaveLength(2)
    expect(res.body.orders.every((o: { customer_phone: string }) => o.customer_phone === e164Phone)).toBe(true)
  })

  it("404s an unknown customer", async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/customers/${encodeURIComponent("+213000000000")}`)
      .set(auth())
      .expect(404)
  })

  it("reads and updates store settings, and reflects the change publicly", async () => {
    const initial = await request(app.getHttpServer())
      .get("/api/admin/store/settings")
      .set(auth())
      .expect(200)
    expect(typeof initial.body.reservation_ttl_minutes).toBe("number")
    expect(initial.body.base_currency).toMatch(/^[A-Z]{3}$/)

    const newName = `Store-${RUN}`
    const updated = await request(app.getHttpServer())
      .patch("/api/admin/store/settings")
      .set(auth())
      .send({ name: newName })
      .expect(200)
    expect(updated.body.name).toBe(newName)

    const publicSettings = await request(app.getHttpServer())
      .get("/api/store/settings")
      .expect(200)
    expect(publicSettings.body.name).toBe(newName)
  })

  it("rejects an unknown base currency and empty updates", async () => {
    const bad = await request(app.getHttpServer())
      .patch("/api/admin/store/settings")
      .set(auth())
      .send({ base_currency: "ZZZ" })
      .expect(400)
    expect(bad.body.code).toBe("UNKNOWN_CURRENCY")

    const empty = await request(app.getHttpServer())
      .patch("/api/admin/store/settings")
      .set(auth())
      .send({})
      .expect(400)
    expect(empty.body.code).toBe("VALIDATION_ERROR")
  })
})
