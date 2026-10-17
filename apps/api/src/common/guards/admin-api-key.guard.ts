import { timingSafeEqual } from "node:crypto"
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { HttpRequestLike } from "../http/request"

export const ADMIN_API_KEY_HEADER = "x-admin-api-key"

/**
 * Phase 2 authorization placeholder for administrative mutations.
 *
 * Administrative writes require a shared key supplied in the
 * `x-admin-api-key` header and matched (constant-time) against `ADMIN_API_KEY`.
 * The guard **fails closed**: if `ADMIN_API_KEY` is not configured, every
 * protected request is rejected.
 *
 * This is intentionally temporary: ADR-0007 replaces it with JWT access tokens
 * + RBAC guards in Phase 3. Until then it ensures Phase 2 mutations are not
 * anonymously writable.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("ADMIN_API_KEY")
    if (!expected) {
      throw new UnauthorizedException({
        code: "ADMIN_API_KEY_NOT_CONFIGURED",
        message: "Administrative API key is not configured on the server",
      })
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>()
    const provided = request.header(ADMIN_API_KEY_HEADER)

    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "A valid administrative API key is required",
      })
    }

    return true
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}
