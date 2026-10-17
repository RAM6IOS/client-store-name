import { validateEnv } from "./env.validation"

describe("validateEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://user@localhost:5432/db",
  }

  it("applies defaults for optional variables", () => {
    const result = validateEnv({ ...baseEnv })

    expect(result.NODE_ENV).toBe("development")
    expect(result.PORT).toBe(3001)
    expect(result.CORS_ORIGINS).toBe("http://localhost:3000")
  })

  it("coerces PORT from string to number", () => {
    const result = validateEnv({ ...baseEnv, PORT: "4000" })
    expect(result.PORT).toBe(4000)
  })

  it("preserves unrelated environment variables", () => {
    const result = validateEnv({ ...baseEnv, PATH: "/usr/bin" })
    expect(result.PATH).toBe("/usr/bin")
  })

  it("throws when DATABASE_URL is missing", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL is required/)
  })

  it("throws when DATABASE_URL is not a postgres URL", () => {
    expect(() => validateEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /postgres:\/\/ or postgresql:\/\//,
    )
  })

  it("throws when PORT is not a positive integer", () => {
    expect(() => validateEnv({ ...baseEnv, PORT: "-1" })).toThrow(/PORT/)
  })
})
