import { Injectable } from "@nestjs/common"
import { OrderStatus } from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { StoreService } from "../store/store.service"

export interface DashboardRecentOrder {
  id: string
  display_id: number
  status: OrderStatus
  customer_name: string
  customer_phone: string
  wilaya_name: string
  total_amount: string
  currency_code: string
  created_at: string
}

export interface DashboardLowStockItem {
  variant_id: string
  variant_title: string
  product_id: string
  product_title: string
  stocked_quantity: number
  reserved_quantity: number
  available_quantity: number
}

export interface DashboardOverview {
  generated_at: string
  currency_code: string
  orders: {
    total: number
    by_status: Record<OrderStatus, number>
    /** Value of non-cancelled orders, in the base currency (minor units). */
    placed_value: string
    /** Value of delivered orders, in the base currency (minor units). */
    delivered_value: string
  }
  customers: {
    total: number
    returning: number
  }
  catalog: {
    products_total: number
    products_published: number
    low_stock: number
  }
  recent_orders: DashboardRecentOrder[]
  low_stock_items: DashboardLowStockItem[]
}

interface RawLowStockRow {
  variant_id: string
  variant_title: string
  product_id: string
  product_title: string
  stocked_quantity: number
  reserved_quantity: number
  available_quantity: number
}

/**
 * Read-only single-store overview. Financial figures are reported in the
 * store's base currency only; orders in other currencies are excluded from the
 * value sums (a starter store prices everything in one currency).
 *
 * "Placed value" is the value of every non-cancelled order (a pipeline figure);
 * "delivered value" is only orders whose status is `delivered` — the closest
 * proxy for realised sales until remittance tracking is wired to money.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const baseCurrency = await this.store.getBaseCurrency()

    const [statusGroups, placed, delivered, customerRows, productsTotal, productsPublished, lowStockRows, recentOrders] =
      await Promise.all([
        this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
        this.prisma.order.aggregate({
          _sum: { total_amount: true },
          where: { currency_code: baseCurrency, status: { not: OrderStatus.cancelled } },
        }),
        this.prisma.order.aggregate({
          _sum: { total_amount: true },
          where: { currency_code: baseCurrency, status: OrderStatus.delivered },
        }),
        this.prisma.$queryRaw<Array<{ total: number; returning: number }>>`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE c > 1)::int AS returning
          FROM (SELECT customer_phone, COUNT(*) c FROM orders GROUP BY customer_phone) t
        `,
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: "published" } }),
        this.prisma.$queryRaw<RawLowStockRow[]>`
          SELECT i.variant_id,
                 v.title AS variant_title,
                 p.id AS product_id,
                 p.title AS product_title,
                 i.stocked_quantity,
                 i.reserved_quantity,
                 (i.stocked_quantity - i.reserved_quantity)::int AS available_quantity
          FROM inventory_items i
          JOIN product_variants v ON v.id = i.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE (i.stocked_quantity - i.reserved_quantity) <= 0
          ORDER BY i.updated_at DESC
          LIMIT 5
        `,
        this.prisma.order.findMany({
          orderBy: { created_at: "desc" },
          take: 5,
          select: {
            id: true,
            display_id: true,
            status: true,
            customer_name: true,
            customer_phone: true,
            wilaya_name: true,
            total_amount: true,
            currency_code: true,
            created_at: true,
          },
        }),
      ])

    const byStatus = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>
    let totalOrders = 0
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all
      totalOrders += group._count._all
    }

    const lowStockCount = lowStockRows.length
    const customers = customerRows[0] ?? { total: 0, returning: 0 }

    return {
      generated_at: new Date().toISOString(),
      currency_code: baseCurrency,
      orders: {
        total: totalOrders,
        by_status: byStatus,
        placed_value: (placed._sum.total_amount ?? 0n).toString(),
        delivered_value: (delivered._sum.total_amount ?? 0n).toString(),
      },
      customers: {
        total: customers.total,
        returning: customers.returning,
      },
      catalog: {
        products_total: productsTotal,
        products_published: productsPublished,
        low_stock: lowStockCount,
      },
      recent_orders: recentOrders.map((order) => ({
        id: order.id,
        display_id: order.display_id,
        status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        wilaya_name: order.wilaya_name,
        total_amount: order.total_amount.toString(),
        currency_code: order.currency_code,
        created_at: order.created_at.toISOString(),
      })),
      low_stock_items: lowStockRows,
    }
  }
}
