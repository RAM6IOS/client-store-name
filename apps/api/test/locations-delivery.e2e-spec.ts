import { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { PrismaService } from "../src/prisma/prisma.service"

const RUN = `loc-${Date.now().toString(36)}`

describe("Locations & delivery (e2e)", () => {
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
  })

  afterAll(async () => {
    await prisma.deliveryRate.deleteMany({ where: { provider: RUN } })
    await app.close()
  })

  describe("locations", () => {
    it("lists all 69 wilayas", async () => {
      const res = await request(app.getHttpServer()).get("/api/locations/wilayas").expect(200)
      expect(res.body.total).toBe(69)
      expect(res.body.data).toHaveLength(69)
    })

    it("returns a single wilaya and 404s an unknown one", async () => {
      const ok = await request(app.getHttpServer()).get("/api/locations/wilayas/16").expect(200)
      expect(ok.body.code).toBe("16")
      await request(app.getHttpServer()).get("/api/locations/wilayas/99").expect(404)
    })

    it("paginates communes of a wilaya", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/locations/wilayas/16/communes")
        .query({ page: 1, pageSize: 5 })
        .expect(200)
      expect(res.body.data).toHaveLength(5)
      expect(res.body.total).toBeGreaterThan(5)
      expect(res.body.data.every((c: { wilaya_code: string }) => c.wilaya_code === "16")).toBe(true)
    })

    it("searches communes and 400s on an empty query", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/locations/communes/search")
        .query({ q: "alger" })
        .expect(200)
      expect(res.body.total).toBeGreaterThan(0)
      await request(app.getHttpServer())
        .get("/api/locations/communes/search")
        .query({ q: "" })
        .expect(400)
    })

    it("exposes dataset metadata and a verification report", async () => {
      const meta = await request(app.getHttpServer()).get("/api/locations/meta").expect(200)
      expect(meta.body.counts.wilayas).toBe(69)
      expect(meta.body.counts.communes).toBe(1541)

      const report = await request(app.getHttpServer())
        .get("/api/locations/verification")
        .expect(200)
      const total =
        report.body.verified +
        report.body.spelling_variant +
        report.body.unmatched +
        report.body.unchecked
      expect(total).toBe(1541)
    })
  })

  describe("delivery", () => {
    it("quotes a configured wilaya/method/currency", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/delivery/quote")
        .send({ wilaya_code: "16", method: "home", currency_code: "DZD" })
        .expect(201)
      expect(res.body.feeAmount).toBe("800")
      expect(res.body.provider).toBe("")
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(
        new Date(res.body.issuedAt).getTime(),
      )
    })

    it("rejects an unknown wilaya at validation", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/delivery/quote")
        .send({ wilaya_code: "99", method: "home", currency_code: "DZD" })
        .expect(400)
      expect(res.body.code).toBe("VALIDATION_ERROR")
    })

    it("returns DELIVERY_UNAVAILABLE when no rate exists", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/delivery/quote")
        .send({ wilaya_code: "16", method: "home", currency_code: "USD" })
        .expect(422)
      expect(res.body.code).toBe("DELIVERY_UNAVAILABLE")
    })

    it("lists methods with availability", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/delivery/methods")
        .query({ wilaya_code: "16", currency_code: "DZD" })
        .expect(200)
      const home = res.body.data.find((m: { method: string }) => m.method === "home")
      const stopDesk = res.body.data.find((m: { method: string }) => m.method === "stop_desk")
      expect(home.available).toBe(true)
      expect(stopDesk.available).toBe(true)
    })

    it("returns no stop desks when no carrier is configured", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/delivery/stop-desks")
        .query({ wilaya_code: "16" })
        .expect(200)
      expect(res.body.data).toEqual([])
      expect(res.body.provider_configured).toBe(false)
    })
  })

  describe("admin delivery configuration", () => {
    it("requires the admin key", async () => {
      await request(app.getHttpServer()).get("/api/admin/shipping/providers").expect(401)
      await request(app.getHttpServer()).get("/api/admin/delivery-rates").expect(401)
      await request(app.getHttpServer())
        .post("/api/admin/delivery-rates")
        .send({ wilaya_code: "16", method: "home", currency_code: "DZD", fee_amount: "1000" })
        .expect(401)
      await request(app.getHttpServer())
        .post("/api/admin/delivery-rates/batch")
        .send({ rates: [] })
        .expect(401)
    })

    it("upserts and updates a rate for a caller-supplied provider", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/admin/delivery-rates")
        .set(auth())
        .send({
          wilaya_code: "69",
          method: "home",
          currency_code: "dzd",
          provider: RUN,
          fee_amount: "1450",
          label: `${RUN} rate`,
        })
        .expect(201)
      expect(created.body.fee_amount).toBe("1450")
      expect(created.body.currency_code).toBe("DZD")

      const updated = await request(app.getHttpServer())
        .patch(`/api/admin/delivery-rates/${created.body.id}`)
        .set(auth())
        .send({ fee_amount: "1600", is_active: false })
        .expect(200)
      expect(updated.body.fee_amount).toBe("1600")
      expect(updated.body.is_active).toBe(false)

      const listed = await request(app.getHttpServer())
        .get("/api/admin/delivery-rates")
        .set(auth())
        .query({ provider: RUN })
        .expect(200)
      expect(listed.body.total).toBe(1)
    })

    it("reports provider status without secrets", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/admin/shipping/providers")
        .set(auth())
        .expect(200)
      expect(res.body.provider).toBeNull()
      expect(res.body.configured).toBe(false)
      expect(JSON.stringify(res.body)).not.toMatch(/api[_-]?key/i)
    })

    it("batch upserts many rates for a provider atomically", async () => {
      const batch = await request(app.getHttpServer())
        .post("/api/admin/delivery-rates/batch")
        .set(auth())
        .send({
          rates: [
            {
              wilaya_code: "69",
              method: "home",
              currency_code: "DZD",
              provider: RUN,
              fee_amount: "900",
            },
            {
              wilaya_code: "69",
              method: "stop_desk",
              currency_code: "DZD",
              provider: RUN,
              fee_amount: "500",
            },
          ],
        })
        .expect(201)
      expect(batch.body.total).toBe(2)

      const listed = await request(app.getHttpServer())
        .get("/api/admin/delivery-rates")
        .set(auth())
        .query({ provider: RUN })
        .expect(200)
      expect(listed.body.total).toBe(2)
    })

    it("rejects a batch with any invalid row and an empty batch", async () => {
      await request(app.getHttpServer())
        .post("/api/admin/delivery-rates/batch")
        .set(auth())
        .send({
          rates: [
            {
              wilaya_code: "69",
              method: "home",
              currency_code: "DZD",
              provider: RUN,
              fee_amount: "-1",
            },
          ],
        })
        .expect(400)

      await request(app.getHttpServer())
        .post("/api/admin/delivery-rates/batch")
        .set(auth())
        .send({ rates: [] })
        .expect(400)
    })
  })
})
