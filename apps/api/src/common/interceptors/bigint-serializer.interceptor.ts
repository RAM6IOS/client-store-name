import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { Observable } from "rxjs"
import { map } from "rxjs/operators"

/**
 * Serialises `BigInt` values (money in minor units, ADR-0005) as strings so
 * they survive JSON encoding without precision loss. Dates and `null`s are
 * passed through unchanged.
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serialize(data)))
  }
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value instanceof Date || value === null || typeof value !== "object") return value

  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    result[key] = serialize(nested)
  }
  return result
}
