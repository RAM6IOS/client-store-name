import { HealthService } from "./health.service"
import type { PrismaService } from "../prisma/prisma.service"

describe("HealthService", () => {
  const createService = (connected: boolean) => {
    const prisma = {
      ping: jest.fn().mockResolvedValue(connected),
    } as unknown as PrismaService
    return new HealthService(prisma)
  }

  it("reports liveness with service metadata", () => {
    const service = createService(true)
    const result = service.check()

    expect(result.status).toBe("ok")
    expect(result.service).toBe("bita-cod-api")
    expect(typeof result.uptime).toBe("number")
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date")
  })

  it("reports a healthy database", async () => {
    const service = createService(true)
    const result = await service.checkDatabase()

    expect(result).toEqual({
      status: "ok",
      database: { connected: true },
      timestamp: expect.any(String),
    })
  })

  it("reports an unreachable database", async () => {
    const service = createService(false)
    const result = await service.checkDatabase()

    expect(result.status).toBe("error")
    expect(result.database.connected).toBe(false)
  })
})
