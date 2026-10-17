import { Injectable } from "@nestjs/common"
import { randomBytes } from "node:crypto"
import { Prisma } from "../generated/prisma/client"
import {
  OrderStatus,
  ShipmentStatus,
  ReservationStatus,
} from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import {
  NotFoundError,
  InsufficientStockError,
  InvalidStockError,
  ConflictError,
} from "../common/errors/domain-error"
import { normalizePhone } from "../common/dz/phone"
import { getWilaya, getCommuneByPostCode, isCommuneOfWilaya } from "../common/dz/locations"
import { InvalidLocationError } from "../common/errors/domain-error"
import { InventoryService } from "../inventory/inventory.service"
import { ShippingService } from "../shipping/shipping.service"
import { DeliveryService, DeliveryQuote } from "./delivery.service"
import { IdempotencyService } from "./idempotency.service"
import { OrderRepository } from "./order.repository"
import { calculateLineSubtotal, calculateTotals } from "./domain/order-totals"
import { ORDER_CREATION_SCOPE } from "./domain/order-policy"
import { canTransition, releasesReservations, shipmentStatusFor } from "./domain/order-transitions"
import { buildOrderOrderBy, buildOrderWhere } from "./domain/order-query"
import { ORDER_EXPORT_COLUMNS, toCsv } from "./csv"
import type {
  CheckoutInput,
  ConfirmOrderInput,
  CancelOrderInput,
  TransitionOrderInput,
  OrderActionInput,
  ListOrdersQuery,
  ExportOrdersQuery,
} from "./dto/orders.schemas"

/** Max rows materialised by the CSV export in a single request. */
export const ORDER_EXPORT_LIMIT = 5000

export interface OrderStatusHistoryView {
  id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  shipment_status: ShipmentStatus | null
  note: string | null
  changed_by: string | null
  created_at: Date
}

export interface OrderReservationView {
  id: string
  order_item_id: string
  inventory_item_id: string
  variant_id: string
  quantity: number
  status: ReservationStatus
  expires_at: Date | null
  released_at: Date | null
  committed_at: Date | null
  created_at: Date
}

export interface OrderPublicView {
  id: string
  display_id: number
  status: OrderStatus
  shipment_status: ShipmentStatus
  collection_status: "cod_pending" | "cod_collected" | "cod_remitted"
  currency_code: string
  subtotal_amount: string
  shipping_amount: string
  discount_amount: string
  total_amount: string
  customer_name: string
  customer_phone: string
  email: string | null
  delivery_method: "home" | "stop_desk"
  delivery_label: string | null
  delivery_provider: string | null
  wilaya_code: string
  wilaya_name: string
  commune: string
  commune_code: string | null
  address_line: string | null
  nearby_landmark: string | null
  notes: string | null
  delivery_quote: Record<string, unknown> | null
  stop_desk: {
    id: string | null
    name: string | null
    provider: string | null
    address: string | null
  } | null
  tracking_token: string | null
  confirmed_at: Date | null
  /** Only present on admin responses — never on the public tracking view. */
  confirmed_by?: string | null
  placed_at: Date
  created_at: Date
  updated_at: Date
  items: Array<{
    id: string
    variant_id: string | null
    product_title: string
    variant_title: string
    sku: string | null
    options: unknown | null
    quantity: number
    unit_amount: string
    line_amount: string
    currency_code: string
  }>
  /** Present on the admin order-detail view. */
  status_history?: OrderStatusHistoryView[]
  /** Present on the admin order-detail view. */
  reservations?: OrderReservationView[]
}

interface ResolvedStopDesk {
  id: string | null
  name: string | null
  provider: string | null
  address: string | null
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly delivery: DeliveryService,
    private readonly shipping: ShippingService,
    private readonly idempotency: IdempotencyService,
    private readonly repo: OrderRepository,
  ) {}

  async checkout(input: CheckoutInput): Promise<OrderPublicView> {
    const existingOrderId = await this.idempotency.getOrderIdByKey(ORDER_CREATION_SCOPE, input.idempotency_key)
    if (existingOrderId) {
      return this.getPublicOrderById(existingOrderId)
    }

    const key = await this.idempotency.getOrCreateOrderKey(input.idempotency_key)
    if (key.order_id) return this.getPublicOrderById(key.order_id)

    const normalizedPhone = normalizePhone(input.customer_phone)
    if (!normalizedPhone) throw new InvalidStockError("Invalid Algerian phone number format")

    const wilaya = getWilaya(input.wilaya_code)
    const commune = this.resolveCommune(input)
    const stopDesk = await this.resolveStopDesk(input)
    const quote = await this.delivery.getQuote(wilaya.code, input.delivery_method, input.currency_code)
    const quoteSnapshot: Record<string, unknown> = {
      ...this.delivery.buildQuoteSnapshot(quote),
      commune_code: commune.code,
      commune_name: commune.name,
    }

    const variants = await this.repo.getVariantsForCheckout(input.currency_code, input.items)
    const currency = await this.prisma.currency.findUnique({ where: { code: input.currency_code.toUpperCase() } })
    if (!currency) throw new NotFoundError(`Currency "${input.currency_code}" not found`)

    const lines = input.items.map((item) => {
      const v = variants.get(item.variant_id)!
      const unit = v.price_amount
      const line = calculateLineSubtotal({ unit_amount: unit, quantity: item.quantity })
      if (v.currency_code !== quote.currencyCode) {
        throw new InvalidStockError("Order currency must match the selected delivery quote currency")
      }
      return {
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_amount: unit,
        line_amount: line,
        product_title: v.product_title,
        variant_title: v.variant_title,
        sku: v.sku,
        inventory_item_id: undefined as string | undefined,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
      }
    })

    const subtotal = lines.reduce((sum, l) => sum + l.line_amount, 0n)
    const discount = 0n
    const shipping = quote.feeAmount
    const totals = calculateTotals({ subtotal, shipping, discount })

    const reservationTtl = await this.getReservationTtlMinutes()
    const expiresAt = reservationTtl > 0 ? new Date(Date.now() + reservationTtl * 60_000) : null

    const trackingToken = randomBytes(24).toString("hex")

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          status: OrderStatus.pending_confirmation,
          shipment_status: ShipmentStatus.pending,
          collection_status: "cod_pending",
          currency_code: input.currency_code.toUpperCase(),
          subtotal_amount: subtotal,
          shipping_amount: shipping,
          discount_amount: discount,
          total_amount: totals.total,
          customer_name: input.customer_name.trim(),
          customer_phone: normalizedPhone!,
          email: input.email ?? null,
          delivery_method: quote.method,
          delivery_label: quote.label,
          delivery_rate_id: quote.deliveryRateId,
          delivery_quote_provider: quote.provider,
          delivery_quote_snapshot: quoteSnapshot as Prisma.InputJsonValue,
          delivery_quote_issued_at: new Date(quote.issuedAt),
          delivery_quote_expires_at: new Date(quote.expiresAt),
          wilaya_code: wilaya.code,
          wilaya_name: wilaya.name_ar,
          commune: commune.name,
          commune_code: commune.code,
          address_line: input.address_line?.trim() ?? null,
          nearby_landmark: input.nearby_landmark?.trim() ?? null,
          notes: input.notes?.trim() ?? null,
          stop_desk_id: stopDesk?.id ?? null,
          stop_desk_name: stopDesk?.name ?? null,
          stop_desk_provider: stopDesk?.provider ?? null,
          stop_desk_address: stopDesk?.address ?? null,
          tracking_token: trackingToken,
          placed_at: new Date(),
          status_history: {
            create: [
              {
                from_status: null,
                to_status: OrderStatus.pending_confirmation,
                shipment_status: ShipmentStatus.pending,
                note: "Order placed (pending confirmation)",
              },
            ],
          },
          items: {
            create: lines.map((l) => ({
              variant_id: l.variant_id,
              product_title: l.product_title,
              variant_title: l.variant_title,
              sku: l.sku,
              quantity: l.quantity,
              unit_amount: l.unit_amount,
              line_amount: l.line_amount,
              currency_code: input.currency_code.toUpperCase(),
              options: undefined,
            })),
          },
        },
        include: { items: true, status_history: true },
      })

      // Resolve inventory items and reserve atomically
      for (const item of created.items) {
        const v = variants.get(item.variant_id!)
        if (!v) continue
        const inv = await (tx as any).inventoryItem.findUnique({ where: { variant_id: item.variant_id! } })
        if (!inv) throw new NotFoundError(`No inventory item for variant "${item.variant_id}"`)
        if (v.manage_inventory) {
          await this.inventory.reserveStock(item.variant_id!, { quantity: item.quantity, reason: "order pending", reference: created.id }, "system")
          await tx.inventoryReservation.create({
            data: {
              order_id: created.id,
              order_item_id: item.id,
              inventory_item_id: inv.id,
              variant_id: item.variant_id!,
              quantity: item.quantity,
              status: ReservationStatus.held,
              expires_at: expiresAt,
            },
          })
        } else {
          await tx.inventoryReservation.create({
            data: {
              order_id: created.id,
              order_item_id: item.id,
              inventory_item_id: inv.id,
              variant_id: item.variant_id!,
              quantity: item.quantity,
              status: ReservationStatus.held,
              expires_at: expiresAt,
            },
          })
        }
      }

      return created
    })

    await this.idempotency.attachOrder(key.id, order.id)
    return this.mapOrderToPublic(order)
  }

  async confirm(orderId: string, input: ConfirmOrderInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.confirmed, {
      actor: input.actor,
      note: input.note ?? "Order confirmed",
    })
  }

  async cancel(orderId: string, input: CancelOrderInput): Promise<OrderPublicView> {
    const note = input.note ? `${input.reason} — ${input.note}` : input.reason
    return this.applyStatusTransition(orderId, OrderStatus.cancelled, {
      actor: input.actor,
      note,
      reason: input.reason,
    })
  }

  async transitionStatus(orderId: string, input: TransitionOrderInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, input.to_status, {
      actor: input.actor,
      note: input.note ?? null,
      reason: input.note ?? null,
    })
  }

  /** confirmed -> preparing. */
  async prepare(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.preparing, {
      actor: input.actor,
      note: input.note ?? "Preparation started",
    })
  }

  /**
   * preparing -> dispatched ("تم الشحن"). Marks the manual/handover dispatch to
   * the carrier only: no carrier shipment is created unless a provider is
   * configured *and* its contract supports it (none in this phase, see
   * docs/decisions/0006 + Phase 6 report).
   */
  async dispatch(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.dispatched, {
      actor: input.actor,
      note: input.note ?? "Dispatched to carrier",
    })
  }

  /** dispatched -> shipped ("في الطريق"). The parcel is en route. */
  async markInTransit(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.shipped, {
      actor: input.actor,
      note: input.note ?? "In transit",
    })
  }

  /** pending_confirmation|confirmed -> no_answer. Stock is retained for a retry. */
  async markNoAnswer(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.no_answer, {
      actor: input.actor,
      note: input.note ?? "Customer did not answer",
    })
  }

  /** pending_confirmation|confirmed -> wrong_number. Stock is retained. */
  async markWrongNumber(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.wrong_number, {
      actor: input.actor,
      note: input.note ?? "Wrong phone number",
    })
  }

  /** shipped -> delivered. Delivery success is NOT collection or remittance. */
  async markDelivered(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.delivered, {
      actor: input.actor,
      note: input.note ?? "Delivered to customer",
    })
  }

  /** shipped -> delivery_failed. Stock is retained for a possible retry. */
  async markDeliveryFailed(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.delivery_failed, {
      actor: input.actor,
      note: input.note ?? "Delivery attempt failed",
    })
  }

  /** shipped|delivered -> returned. Returns the outstanding stock to availability. */
  async markReturned(orderId: string, input: OrderActionInput): Promise<OrderPublicView> {
    return this.applyStatusTransition(orderId, OrderStatus.returned, {
      actor: input.actor,
      note: input.note ?? "Order returned",
      reason: "returned",
    })
  }

  /**
   * The single, guarded mutation path for every order status change.
   *
   * - Re-validates the transition against the state machine (`canTransition`).
   * - Applies a *conditional* update (`WHERE status = <observed>`), so two
   *   concurrent transitions race and exactly one wins; the loser gets a 409.
   * - Appends exactly one immutable history row and mirrors the shipment status.
   * - On confirmation, commits held reservations; on cancellation/return,
   *   releases outstanding reservations once (idempotent under retries).
   */
  private async applyStatusTransition(
    orderId: string,
    toStatus: OrderStatus,
    ctx: { actor: string; note: string | null; reason?: string | null },
  ): Promise<OrderPublicView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { reservations: true },
    })
    if (!order) throw new NotFoundError(`Order "${orderId}" not found`)
    this.ensureTransition(order.status, toStatus)

    const fromStatus = order.status
    const shipment = shipmentStatusFor(toStatus)
    const now = new Date()

    const managedVariants = await this.getManagedVariants(
      order.reservations.map((reservation) => reservation.variant_id),
    )

    await this.prisma.$transaction(async (tx) => {
      const applied = await tx.order.updateMany({
        where: { id: orderId, status: fromStatus },
        data: {
          status: toStatus,
          ...(shipment ? { shipment_status: shipment } : {}),
          ...(toStatus === OrderStatus.confirmed
            ? { confirmed_at: now, confirmed_by: ctx.actor }
            : {}),
        },
      })
      if (applied.count === 0) {
        throw new ConflictError(
          "Order status changed concurrently; reload the order and try again",
          "INVALID_TRANSITION",
        )
      }

      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          from_status: fromStatus,
          to_status: toStatus,
          shipment_status: shipment,
          note: ctx.note,
          changed_by: ctx.actor,
        },
      })

      if (toStatus === OrderStatus.confirmed) {
        await tx.inventoryReservation.updateMany({
          where: { order_id: orderId, status: ReservationStatus.held },
          data: { status: ReservationStatus.committed, committed_at: now, expires_at: null },
        })
      }

      if (releasesReservations(toStatus)) {
        const outstanding = order.reservations.filter(
          (reservation) => reservation.status !== ReservationStatus.released,
        )
        for (const reservation of outstanding) {
          if (managedVariants.get(reservation.variant_id)) {
            await this.inventory.releaseStockTx(
              tx,
              reservation.variant_id,
              {
                quantity: reservation.quantity,
                reason: ctx.reason ?? `order ${toStatus}`,
                reference: orderId,
              },
              ctx.actor,
            )
          }
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: ReservationStatus.released, released_at: now, expires_at: null },
          })
        }
      }
    })

    return this.getPublicOrderById(orderId)
  }

  /** variant_id -> whether its stock is actually tracked by the inventory ledger. */
  private async getManagedVariants(variantIds: string[]): Promise<Map<string, boolean>> {
    const unique = [...new Set(variantIds)]
    if (unique.length === 0) return new Map()
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: unique } },
      select: { id: true, manage_inventory: true },
    })
    return new Map(variants.map((variant) => [variant.id, variant.manage_inventory]))
  }

  /**
   * Public/operational read used by the tracking page and by internal callers
   * after a mutation. Deliberately excludes the status history, reservations
   * and actor information.
   */
  async getPublicOrderById(id: string): Promise<OrderPublicView> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!order) throw new NotFoundError(`Order "${id}" not found`)
    return this.mapOrderToPublic(order)
  }

  async getPublicOrderByToken(token: string): Promise<OrderPublicView> {
    const order = await this.prisma.order.findUnique({
      where: { tracking_token: token },
      include: { items: true },
    })
    if (!order) throw new NotFoundError(`Order not found`)
    return this.mapOrderToPublic(order)
  }

  /**
   * Admin order detail: immutable snapshots plus the append-only status history
   * and reservation state. `confirmed_by` is the operator label recorded in
   * history (never a credential).
   */
  async getAdminOrderById(id: string): Promise<OrderPublicView> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { id: "asc" } },
        status_history: { orderBy: { created_at: "asc" } },
        reservations: { orderBy: { created_at: "asc" } },
      },
    })
    if (!order) throw new NotFoundError(`Order "${id}" not found`)
    return this.mapOrderToPublic(order, { includeHistory: true, adminView: true })
  }

  async listOrders(query: ListOrdersQuery): Promise<{
    data: OrderPublicView[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }> {
    const page = query.page
    const pageSize = query.pageSize
    const where = buildOrderWhere(query)
    const orderBy = buildOrderOrderBy(query.sort, query.order)

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ])
    return {
      data: orders.map((o) => this.mapOrderToPublic(o, { adminView: true })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  /**
   * CSV export of the *currently filtered* order set. Uses the same `where` as
   * the list so the file matches what the operator sees, without pagination.
   * `ORDER_EXPORT_COLUMNS` omits tracking tokens and the delivery-quote payload.
   */
  async exportOrders(query: ExportOrdersQuery): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: buildOrderWhere(query),
      orderBy: buildOrderOrderBy(query.sort, query.order),
      take: ORDER_EXPORT_LIMIT,
    })
    const rows = orders.map((order) => ({
      display_id: order.display_id,
      status: order.status,
      shipment_status: order.shipment_status,
      collection_status: order.collection_status,
      created_at: order.created_at.toISOString(),
      placed_at: order.placed_at.toISOString(),
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      wilaya_code: order.wilaya_code,
      wilaya_name: order.wilaya_name,
      commune: order.commune,
      commune_code: order.commune_code,
      delivery_method: order.delivery_method,
      delivery_label: order.delivery_label,
      subtotal_amount: order.subtotal_amount.toString(),
      shipping_amount: order.shipping_amount.toString(),
      discount_amount: order.discount_amount.toString(),
      total_amount: order.total_amount.toString(),
      currency_code: order.currency_code,
    }))
    return toCsv(rows, ORDER_EXPORT_COLUMNS)
  }

  /** All orders for a customer, newest first (used by the admin customers view). */
  async listOrdersByPhone(phone: string): Promise<OrderPublicView[]> {
    const orders = await this.prisma.order.findMany({
      where: { customer_phone: phone },
      include: { items: true },
      orderBy: { created_at: "desc" },
    })
    return orders.map((order) => this.mapOrderToPublic(order, { adminView: true }))
  }

  private async getReservationTtlMinutes(): Promise<number> {
    const settings = await this.prisma.storeSetting.findFirst()
    return settings?.reservation_ttl_minutes ?? 60
  }

  /**
   * Resolve the destination commune. A `commune_code` (postal code) must belong
   * to the chosen wilaya; the dataset name is used as the display snapshot.
   * Free-text `commune` remains supported for unmatched/legacy addresses.
   */
  private resolveCommune(input: CheckoutInput): { name: string; code: string | null } {
    const code = input.commune_code?.trim() ?? ""
    if (code) {
      if (!isCommuneOfWilaya(input.wilaya_code, code)) {
        throw new InvalidLocationError(
          `Commune "${code}" does not belong to wilaya "${input.wilaya_code}"`,
          { wilayaCode: input.wilaya_code, communeCode: code },
        )
      }
      const ref = getCommuneByPostCode(code)
      return { name: input.commune?.trim() || ref?.name_fr || code, code }
    }
    return { name: input.commune.trim(), code: null }
  }

  /**
   * Resolve stop-desk details. When a provider is configured the stop desk is
   * validated against the provider; otherwise the supplied values are stored as
   * a schema-ready snapshot (no fabricated desks).
   */
  private async resolveStopDesk(input: CheckoutInput): Promise<ResolvedStopDesk | null> {
    if (input.delivery_method !== "stop_desk") return null
    if (this.shipping.isConfigured && input.stop_desk_id) {
      const desks = await this.shipping.listStopDesks(input.wilaya_code)
      const desk = desks.find((candidate) => candidate.id === input.stop_desk_id)
      if (!desk) {
        throw new InvalidLocationError(
          `Unknown stop desk "${input.stop_desk_id}" for wilaya "${input.wilaya_code}"`,
          { wilayaCode: input.wilaya_code, stopDeskId: input.stop_desk_id },
        )
      }
      return { id: desk.id, name: desk.name, provider: desk.provider, address: desk.address }
    }
    if (!input.stop_desk_id && !input.stop_desk_name) return null
    return {
      id: input.stop_desk_id?.trim() ?? null,
      name: input.stop_desk_name?.trim() ?? null,
      provider: this.shipping.getStatus().provider,
      address: input.stop_desk_address?.trim() ?? null,
    }
  }

  private ensureTransition(from: OrderStatus, to: OrderStatus) {
    if (!canTransition(from, to)) {
      throw new ConflictError(`Order cannot transition from ${from} to ${to}`, "INVALID_TRANSITION")
    }
  }

  private mapOrderToPublic(
    order: any,
    options: { includeHistory?: boolean; adminView?: boolean } = {},
  ): OrderPublicView {
    const view: OrderPublicView = {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      shipment_status: order.shipment_status,
      collection_status: order.collection_status,
      currency_code: order.currency_code,
      subtotal_amount: order.subtotal_amount.toString(),
      shipping_amount: order.shipping_amount.toString(),
      discount_amount: order.discount_amount.toString(),
      total_amount: order.total_amount.toString(),
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      email: order.email,
      delivery_method: order.delivery_method,
      delivery_label: order.delivery_label,
      delivery_provider: order.delivery_quote_provider,
      wilaya_code: order.wilaya_code,
      wilaya_name: order.wilaya_name,
      commune: order.commune,
      commune_code: order.commune_code,
      address_line: order.address_line,
      nearby_landmark: order.nearby_landmark,
      notes: order.notes,
      delivery_quote: order.delivery_quote_snapshot ?? null,
      stop_desk: order.stop_desk_id || order.stop_desk_name
        ? {
            id: order.stop_desk_id,
            name: order.stop_desk_name,
            provider: order.stop_desk_provider,
            address: order.stop_desk_address,
          }
        : null,
      tracking_token: order.tracking_token,
      confirmed_at: order.confirmed_at,
      placed_at: order.placed_at,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.items.map((i: any) => ({
        id: i.id,
        variant_id: i.variant_id,
        product_title: i.product_title,
        variant_title: i.variant_title,
        sku: i.sku,
        options: i.options,
        quantity: i.quantity,
        unit_amount: i.unit_amount.toString(),
        line_amount: i.line_amount.toString(),
        currency_code: i.currency_code,
      })),
    }

    if (options.adminView) {
      view.confirmed_by = order.confirmed_by
    }

    if (options.includeHistory) {
      view.status_history = (order.status_history ?? []).map((entry: any) => ({
        id: entry.id,
        from_status: entry.from_status,
        to_status: entry.to_status,
        shipment_status: entry.shipment_status,
        note: entry.note,
        changed_by: entry.changed_by,
        created_at: entry.created_at,
      }))
      view.reservations = (order.reservations ?? []).map((reservation: any) => ({
        id: reservation.id,
        order_item_id: reservation.order_item_id,
        inventory_item_id: reservation.inventory_item_id,
        variant_id: reservation.variant_id,
        quantity: reservation.quantity,
        status: reservation.status,
        expires_at: reservation.expires_at,
        released_at: reservation.released_at,
        committed_at: reservation.committed_at,
        created_at: reservation.created_at,
      }))
    }

    return view
  }
}