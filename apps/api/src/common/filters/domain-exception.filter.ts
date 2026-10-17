import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { ZodError } from "zod"
import { Prisma } from "../../generated/prisma/client"
import { DomainError, type DomainErrorCode } from "../errors/domain-error"
import type { HttpResponseLike, HttpRequestLike } from "../http/request"

interface ErrorBody {
  statusCode: number
  code: string
  message: string
  details?: unknown
  path?: string
  timestamp: string
}

/**
 * Single place that turns errors into HTTP responses. Services throw typed
 * `DomainError`s; Prisma and Zod errors are mapped here so controllers stay
 * free of HTTP concerns.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<HttpResponseLike>()
    const request = ctx.getRequest<HttpRequestLike>()

    const { status, body } = this.mapException(exception, request)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request?.method ?? "?"} ${request?.url ?? "?"} -> ${status}: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    response.status(status).json(body)
  }

  private mapException(
    exception: unknown,
    request?: HttpRequestLike,
  ): { status: number; body: ErrorBody } {
    const timestamp = new Date().toISOString()
    const path = request?.url
    const withMeta = (
      status: number,
      code: string,
      message: string,
      details?: unknown,
    ): ErrorBody => ({
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      path,
      timestamp,
    })

    if (exception instanceof DomainError) {
      return {
        status: exception.httpStatus,
        body: withMeta(exception.httpStatus, exception.code, exception.message, exception.details),
      }
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: withMeta(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed", {
          issues: exception.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception, withMeta)
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === "string") {
        return { status, body: withMeta(status, this.defaultCode(status), res) }
      }
      const resBody = res as Record<string, unknown>
      const rawMessage = resBody.message
      const message = Array.isArray(rawMessage)
        ? rawMessage.join("; ")
        : String(rawMessage ?? exception.message)
      const code = typeof resBody.code === "string" ? resBody.code : this.defaultCode(status)
      return {
        status,
        body: withMeta(status, code, message, resBody.details ?? resBody.issues),
      }
    }

    if (this.isMulterError(exception)) {
      const { status, code, message } = this.mapMulterError(exception)
      return {
        status,
        body: withMeta(status, code, message, { code: exception.code, field: exception.field }),
      }
    }

    if (this.isPgCheckViolation(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        body: withMeta(
          HttpStatus.CONFLICT,
          "INVALID_STOCK",
          "The change violates an inventory or pricing invariant",
        ),
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: withMeta(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error"),
    }
  }

  private mapPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    withMeta: (status: number, code: string, message: string, details?: unknown) => ErrorBody,
  ): { status: number; body: ErrorBody } {
    const metaTarget = Array.isArray(exception.meta?.target)
      ? (exception.meta?.target as string[]).join(",")
      : String(exception.meta?.target ?? "")
    const target = metaTarget || this.prismaConstraint(exception.message)

    switch (exception.code) {
      case "P2002": {
        const haystack = target.toLowerCase()
        const code: DomainErrorCode = haystack.includes("sku")
          ? "DUPLICATE_SKU"
          : haystack.includes("handle")
            ? "DUPLICATE_HANDLE"
            : haystack.includes("slug")
              ? "DUPLICATE_SLUG"
              : "CONFLICT"
        return {
          status: HttpStatus.CONFLICT,
          body: withMeta(
            HttpStatus.CONFLICT,
            code,
            target ? `Duplicate value on: ${target}` : "A unique constraint was violated",
          ),
        }
      }
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          body: withMeta(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found"),
        }
      case "P2003":
        return {
          status: HttpStatus.CONFLICT,
          body: withMeta(
            HttpStatus.CONFLICT,
            "CONFLICT",
            "Operation violates a relational constraint (referenced row missing or still referenced)",
          ),
        }
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: withMeta(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            `Database request error (${exception.code})`,
          ),
        }
    }
  }

  private prismaConstraint(message: string): string {
    const match = /constraint:? (?:on the constraint: )?`([^`]+)`/.exec(message)
    if (match) return match[1]
    const fields = /Unique constraint failed on the fields:? `([^`]+)`/.exec(message)
    if (fields) return fields[1]
    return ""
  }

  private isPgCheckViolation(exception: unknown): boolean {
    return (
      typeof exception === "object" &&
      exception !== null &&
      ((exception as { code?: string }).code === "23514" ||
        /check constraint|violates check/i.test(String((exception as Error).message)))
    )
  }

  private defaultCode(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return "VALIDATION_ERROR"
    if (status === HttpStatus.UNAUTHORIZED) return "UNAUTHORIZED"
    if (status === HttpStatus.FORBIDDEN) return "FORBIDDEN"
    if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND"
    if (status === HttpStatus.CONFLICT) return "CONFLICT"
    return "HTTP_ERROR"
  }

  /** Multipart upload pipe errors from multer need a stable, non-500 mapping so
   * browsers get a plain reason instead of "internal error". */
  private isMulterError(
    exception: unknown,
  ): exception is { name: "MulterError"; code?: string; field?: string } {
    return (
      typeof exception === "object" &&
      exception !== null &&
      (exception as { name?: string }).name === "MulterError"
    )
  }

  private mapMulterError(exception: { code?: string; field?: string }): {
    status: number
    code: string
    message: string
  } {
    switch (exception.code) {
      case "LIMIT_FILE_SIZE":
        return {
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          code: "FILE_TOO_LARGE",
          message: "Uploaded file exceeds the maximum allowed size",
        }
      case "LIMIT_FILE_COUNT":
      case "LIMIT_FIELD_COUNT":
        return {
          status: HttpStatus.BAD_REQUEST,
          code: "FILE_COUNT_EXCEEDED",
          message: "More files were uploaded than allowed",
        }
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          code: "VALIDATION_ERROR",
          message: "Invalid multipart upload",
        }
    }
  }
}
