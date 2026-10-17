import { NextResponse, type NextRequest } from "next/server"
import { exportAdminOrdersCsv } from "@/lib/admin/client"
import { parseOrderFilters, parseOrderSort } from "@/lib/admin/query"
import { getAdminKey } from "@/lib/admin/session"

/**
 * Streams the filtered order set as a CSV download. The admin key is read from
 * the httpOnly session cookie and forwarded as a header — it never appears in
 * the URL, the page HTML or client JavaScript.
 */
export async function GET(request: NextRequest) {
  const key = await getAdminKey()
  if (!key) {
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  const raw: Record<string, string | string[] | undefined> = {}
  request.nextUrl.searchParams.forEach((value, name) => {
    raw[name] = value
  })

  const filters = parseOrderFilters(raw)
  const { sort, order } = parseOrderSort(raw)

  try {
    const csv = await exportAdminOrdersCsv(key, { ...filters, sort, order })
    const timestamp = new Date().toISOString().slice(0, 10)
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="orders-${timestamp}.csv"`,
        "cache-control": "no-store",
      },
    })
  } catch {
    return new Response("Export failed", { status: 502 })
  }
}
