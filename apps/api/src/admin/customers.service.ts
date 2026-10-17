import { Injectable } from "@nestjs/common"
import { Prisma } from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { StoreService } from "../store/store.service"
import { OrderService, type OrderPublicView } from "../orders/order.service"
import { normalizePhone } from "../common/dz/phone"
import { NotFoundError } from "../common/errors/domain-error"
import type { ListCustomersQuery } from "./dto/customers.schemas"

export interface CustomerSummary {
  phone: string
  name: string
  orders_count: number
  delivered_count: number
  cancelled_count: number
  returned_count: number
  /** Sum of non-cancelled order totals, in the store base currency (minor units). */
  total_spent: string
  first_order_at: string
  last_order_at: string
  last_wilaya_name: string
}

export interface CustomerDetail extends CustomerSummary {
  currency_code: string
  orders: OrderPublicView[]
}

interface RawCustomerRow {
  phone: string
  name: string | null
  last_wilaya_name: string | null
  orders_count: number
  delivered_count: number
  cancelled_count: number
  returned_count: number
  total_spent: string
  first_order_at: Date
  last_order_at: Date
}

/**
 * Customers are derived from order snapshots: the storefront is guest-only, so
 * the order's stored phone is the only stable customer identity. Grouping by
 * phone gives order counts, lifetime value and recency without a schema change
 * or a backfill (see the Phase 7 gap analysis).
 *
 * Aggregation is done in Postgres: `GROUP BY` the phone and aggregate the whole
 * group, then filter *groups* (not rows) with `HAVING` so a name search never
 * truncates a customer's totals.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly orders: OrderService,
  ) {}

  async list(query: ListCustomersQuery): Promise<{
    currency_code: string
    data: CustomerSummary[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }> {
    const { page, pageSize } = query
    const baseCurrency = await this.store.getBaseCurrency()
    const having = buildHaving(query.search)

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RawCustomerRow[]>(Prisma.sql`
        SELECT
          o.customer_phone AS phone,
          (array_agg(o.customer_name ORDER BY o.created_at DESC))[1] AS name,
          (array_agg(o.wilaya_name ORDER BY o.created_at DESC))[1] AS last_wilaya_name,
          COUNT(*)::int AS orders_count,
          COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count,
          COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
          COUNT(*) FILTER (WHERE o.status = 'returned')::int AS returned_count,
          COALESCE(
            SUM(o.total_amount) FILTER (
              WHERE o.status <> 'cancelled' AND o.currency_code = ${baseCurrency}
            ),
            0
          )::text AS total_spent,
          MIN(o.created_at) AS first_order_at,
          MAX(o.created_at) AS last_order_at
        FROM orders o
        GROUP BY o.customer_phone
        ${having}
        ORDER BY MAX(o.created_at) DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM (
          SELECT o.customer_phone
          FROM orders o
          GROUP BY o.customer_phone
          ${having}
        ) t
      `),
    ])

    const total = countRows[0]?.total ?? 0
    return {
      currency_code: baseCurrency,
      data: rows.map((row) => ({
        phone: row.phone,
        name: row.name ?? row.phone,
        orders_count: row.orders_count,
        delivered_count: row.delivered_count,
        cancelled_count: row.cancelled_count,
        returned_count: row.returned_count,
        total_spent: row.total_spent,
        first_order_at: toIso(row.first_order_at),
        last_order_at: toIso(row.last_order_at),
        last_wilaya_name: row.last_wilaya_name ?? "",
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  async get(phoneInput: string): Promise<CustomerDetail> {
    const phone = normalizePhone(phoneInput) ?? phoneInput.trim()
    const orders = await this.orders.listOrdersByPhone(phone)
    if (orders.length === 0) throw new NotFoundError(`Customer "${phone}" not found`)

    const baseCurrency = await this.store.getBaseCurrency()
    const totalSpent = orders
      .filter((order) => order.status !== "cancelled" && order.currency_code === baseCurrency)
      .reduce((sum, order) => sum + BigInt(order.total_amount), 0n)

    const newest = orders[0]!
    const oldest = orders[orders.length - 1]!
    return {
      phone,
      name: newest.customer_name,
      orders_count: orders.length,
      delivered_count: orders.filter((order) => order.status === "delivered").length,
      cancelled_count: orders.filter((order) => order.status === "cancelled").length,
      returned_count: orders.filter((order) => order.status === "returned").length,
      total_spent: totalSpent.toString(),
      first_order_at: toIso(oldest.created_at),
      last_order_at: toIso(newest.created_at),
      last_wilaya_name: newest.wilaya_name,
      currency_code: baseCurrency,
      orders,
    }
  }
}

function buildHaving(search: string | undefined): Prisma.Sql {
  const term = search?.trim()
  if (!term) return Prisma.empty

  const clauses: Prisma.Sql[] = [Prisma.sql`bool_or(o.customer_name ILIKE ${`%${term}%`})`]
  const digits = term.replace(/\D/g, "")
  if (digits) clauses.push(Prisma.sql`o.customer_phone LIKE ${`%${digits}%`}`)
  const normalized = normalizePhone(term)
  if (normalized) clauses.push(Prisma.sql`o.customer_phone = ${normalized}`)

  return Prisma.sql`HAVING (${Prisma.join(clauses, " OR ")})`
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}
