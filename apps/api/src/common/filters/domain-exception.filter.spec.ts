import { HttpException, HttpStatus } from "@nestjs/common"
import { ZodError } from "zod"
import { Prisma } from "../../generated/prisma/client"
import { DomainError } from "../errors/domain-error"
import { DomainExceptionFilter } from "./domain-exception.filter"

function prismaError(
  code: string,
  message: string,
  meta: Record<string, unknown> = {},
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "7.10.0-test",
    meta,
  })
}

describe("DomainExceptionFilter", () => {
  const filter = new DomainExceptionFilter() as unknown as {
    mapException: (e: unknown) => {
      status: number
      body: { code: string; message: string }
    }
  }

  describe("P2002 unique violations", () => {
    it("maps a verbose message with constraint backtick to DUPLICATE_SKU with a clean message", () => {
      const err = prismaError(
        "P2002",
        "Invalid `this.prisma.product.create()` invocation in\n/srv/app.ts:50:46\n\n".concat(
          "Unique constraint failed on the constraint: `product_variants_sku_key`",
        ),
      )
      const { status, body } = filter.mapException(err)
      expect(status).toBe(HttpStatus.CONFLICT)
      expect(body.code).toBe("DUPLICATE_SKU")
      expect(body.message).toBe("Duplicate value on: product_variants_sku_key")
    })

    it("uses meta.target when present", () => {
      const err = prismaError("P2002", "Unique constraint failed", {
        target: ["slug"],
      })
      const { body } = filter.mapException(err)
      expect(body.code).toBe("DUPLICATE_SLUG")
      expect(body.message).toBe("Duplicate value on: slug")
    })

    it("falls back to a generic message when no target is known", () => {
      const err = prismaError("P2002", "Unique constraint failed")
      const { body } = filter.mapException(err)
      expect(body.code).toBe("CONFLICT")
      expect(body.message).toBe("A unique constraint was violated")
    })
  })

  describe("other Prisma errors", () => {
    it("maps P2025 to 404 NOT_FOUND", () => {
      const err = prismaError(
        "P2025",
        "An operation failed because it depends on one or more records that were required but not found.",
      )
      const { status, body } = filter.mapException(err)
      expect(status).toBe(HttpStatus.NOT_FOUND)
      expect(body.code).toBe("NOT_FOUND")
      expect(body.message).toBe("Resource not found")
    })

    it("maps P2003 to 409 CONFLICT", () => {
      const { status, body } = filter.mapException(prismaError("P2003", "fk violated"))
      expect(status).toBe(HttpStatus.CONFLICT)
      expect(body.code).toBe("CONFLICT")
    })
  })

  it("maps a DomainError to its httpStatus and code", () => {
    const err = new DomainError("Handle already in use", "DUPLICATE_HANDLE", 409)
    const { status, body } = filter.mapException(err)
    expect(status).toBe(409)
    expect(body.code).toBe("DUPLICATE_HANDLE")
    expect(body.message).toBe("Handle already in use")
  })

  it("maps a ZodError to 400 VALIDATION_ERROR with issues", () => {
    const err = new ZodError([{ code: "custom", path: ["title"], message: "Required" }] as never)
    const { status, body } = filter.mapException(err)
    expect(status).toBe(HttpStatus.BAD_REQUEST)
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("maps a pg check violation (23514) to 409 INVALID_STOCK", () => {
    const err = Object.assign(new Error("check constraint violated"), { code: "23514" })
    const { status, body } = filter.mapException(err)
    expect(status).toBe(HttpStatus.CONFLICT)
    expect(body.code).toBe("INVALID_STOCK")
  })

  it("maps an HttpException with an array message", () => {
    const err = new HttpException({ message: ["a", "b"], code: "X" }, 400)
    const { body } = filter.mapException(err)
    expect(body.code).toBe("X")
    expect(body.message).toBe("a; b")
  })

  it("maps unknown errors to 500 INTERNAL_ERROR", () => {
    const { status, body } = filter.mapException(new Error("boom"))
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.code).toBe("INTERNAL_ERROR")
    expect(body.message).not.toContain("boom")
  })
})
