import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"

/**
 * Validates a request payload against a Zod schema and returns the parsed
 * (typed, stripped) value. Validation failures become a 400 with a stable
 * `VALIDATION_ERROR` code and per-field issues.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      })
    }
    return result.data
  }
}
