import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { HealthService, LivenessResult, ReadinessResult } from "./health.service"

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up and serving requests. */
  @Get()
  check(): LivenessResult {
    return this.health.check()
  }

  /** Readiness: the API can reach PostgreSQL. */
  @Get("db")
  async db(): Promise<ReadinessResult> {
    const result = await this.health.checkDatabase()
    if (!result.database.connected) {
      throw new ServiceUnavailableException(result)
    }
    return result
  }
}
