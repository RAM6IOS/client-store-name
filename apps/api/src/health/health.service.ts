import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

export interface LivenessResult {
  status: "ok"
  service: string
  uptime: number
  timestamp: string
}

export interface ReadinessResult {
  status: "ok" | "error"
  database: { connected: boolean }
  timestamp: string
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check(): LivenessResult {
    return {
      status: "ok",
      service: "bita-cod-api",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }

  async checkDatabase(): Promise<ReadinessResult> {
    const connected = await this.prisma.ping()
    return {
      status: connected ? "ok" : "error",
      database: { connected },
      timestamp: new Date().toISOString(),
    }
  }
}
