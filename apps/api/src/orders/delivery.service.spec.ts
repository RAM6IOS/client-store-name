import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../prisma/prisma.service"
import { DeliveryUnavailableError, InvalidLocationError } from "../common/errors/domain-error"
import { DeliveryService, STORE_PROVIDER } from "./delivery.service"

function makeService(overrides: Partial<Record<"wilaya" | "deliveryRate", unknown>> = {}) {
  const prisma = {
    wilaya: { findUnique: jest.fn().mockResolvedValue({ is_active: true }) },
    deliveryRate: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as unknown as PrismaService
  const config = { get: jest.fn().mockReturnValue(900) } as unknown as ConfigService
  return { service: new DeliveryService(prisma, config), prisma, config }
}

describe("DeliveryService", () => {
  it("rejects an unknown wilaya with INVALID_LOCATION", async () => {
    const { service } = makeService()
    await expect(service.getQuote("99", "home", "DZD")).rejects.toBeInstanceOf(InvalidLocationError)
  })

  it("rejects a disabled wilaya with DELIVERY_UNAVAILABLE", async () => {
    const { service } = makeService({
      wilaya: { findUnique: jest.fn().mockResolvedValue({ is_active: false }) },
    })
    await expect(service.getQuote("16", "home", "DZD")).rejects.toBeInstanceOf(
      DeliveryUnavailableError,
    )
  })

  it("rejects when no active rate exists", async () => {
    const { service } = makeService()
    await expect(service.getQuote("16", "home", "DZD")).rejects.toBeInstanceOf(
      DeliveryUnavailableError,
    )
  })

  it("produces a quote with an expiry derived from the configured TTL", async () => {
    const rate = {
      id: "rate-1",
      method: "home" as const,
      currency_code: "DZD",
      fee_amount: 800n,
      label: "Alger - Home",
      provider: "",
      wilaya_code: "16",
      is_active: true,
    }
    const { service } = makeService({
      deliveryRate: {
        findFirst: jest.fn().mockResolvedValue(rate),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    })
    const quote = await service.getQuote("16", "home", "dzd")
    expect(quote.feeAmount).toBe(800n)
    expect(service).toBeDefined()
    const ttl = new Date(quote.expiresAt).getTime() - new Date(quote.issuedAt).getTime()
    expect(ttl).toBe(900_000)
  })

  it("lists both methods, marking availability from active rates", async () => {
    const { service } = makeService({
      deliveryRate: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { method: "home", fee_amount: 800n, label: "Standard", provider: "" },
          ]),
      },
    })
    const methods = await service.listMethods("16", "DZD")
    expect(methods.map((m) => m.method)).toEqual(["home", "stop_desk"])
    expect(methods.find((m) => m.method === "home")?.available).toBe(true)
    expect(methods.find((m) => m.method === "stop_desk")?.available).toBe(false)
    expect(methods.find((m) => m.method === "stop_desk")?.feeAmount).toBeNull()
  })

  it("refuses a rate that has been deactivated", async () => {
    const { service } = makeService({
      deliveryRate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ is_active: false }),
      },
    })
    await expect(service.ensureActiveRate("rate-1")).rejects.toBeInstanceOf(
      DeliveryUnavailableError,
    )
  })

  it("serialises the frozen quote snapshot without losing precision", async () => {
    const { service } = makeService()
    const snapshot = service.buildQuoteSnapshot({
      deliveryRateId: "rate-1",
      method: "home",
      currencyCode: "DZD",
      feeAmount: 12345n,
      label: null,
      provider: STORE_PROVIDER,
      wilayaCode: "16",
      wilayaName: "الجزائر",
      wilayaNameFr: "Alger",
      issuedAt: "2026-10-11T00:00:00.000Z",
      expiresAt: "2026-10-11T00:15:00.000Z",
    })
    expect(snapshot.fee_amount).toBe("12345")
    expect(snapshot.currency_code).toBe("DZD")
  })
})
