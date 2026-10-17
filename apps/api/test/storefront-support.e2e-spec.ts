import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `pbf-${Date.now().toString(36)}`

describe("Storefront support endpoints (e2e)", () => {
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
    await prisma.product.deleteMany({ where: { handle: { startsWith: RUN } } })
    await app.close()
  })

  it("exposes public store settings without secrets", async () => {
    const res = await request(app.getHttpServer()).get("/api/store/settings").expect(200)
    expect(res.body.name).toBeTruthy()
    expect(res.body.base_currency).toMatch(/^[A-Z]{3}$/)
    expect(typeof res.body.cod_enabled).toBe("boolean")
    expect(res.body.default_locale).toBeTruthy()
    expect(res.body).not.toHaveProperty("admin_api_key")
  })

  it("looks a product up by handle", async () => {
    const handle = `${RUN}-tee`
    await request(app.getHttpServer())
      .post("/api/catalog/products")
      .set(auth())
      .send({
        title: "Tee",
        handle,
        status: "published",
        currency_code: "DZD",
        price_amount: "120000",
        sku: `${handle}-M`.toUpperCase(),
        initial_stock: 3,
      })
      .expect(201)

    const res = await request(app.getHttpServer())
      .get(`/api/catalog/products/by-handle/${handle}`)
      .expect(200)
    expect(res.body.handle).toBe(handle)
    expect(res.body.variants).toHaveLength(1)
  })

  it("404s an unknown handle", async () => {
    await request(app.getHttpServer())
      .get(`/api/catalog/products/by-handle/${RUN}-missing`)
      .expect(404)
  })
})
