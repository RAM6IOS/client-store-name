import { describe, expect, it } from "vitest"
import { apiUrl } from "./api"

describe("apiUrl", () => {
  it("joins the base URL and a leading-slash path", () => {
    expect(apiUrl("/health")).toBe("http://localhost:3001/api/health")
  })

  it("adds a leading slash when the path omits one", () => {
    expect(apiUrl("health")).toBe("http://localhost:3001/api/health")
  })

  it("does not duplicate slashes", () => {
    expect(apiUrl("/health/db")).toBe("http://localhost:3001/api/health/db")
  })
})
