import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

/**
 * Single Prisma client instance for the API. Uses the PostgreSQL driver
 * adapter (required by Prisma 7) and a connection string sourced from the
 * validated environment.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL ?? ""
    super({ adapter: new PrismaPg({ connectionString }) })
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect()
      this.logger.log("Prisma connected to the database")
    } catch (error) {
      // Do not crash the process: readiness is reported through /api/health/db.
      this.logger.error(`Prisma failed to connect at startup: ${(error as Error).message}`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  /** Lightweight connectivity probe used by the readiness endpoint. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }
}
