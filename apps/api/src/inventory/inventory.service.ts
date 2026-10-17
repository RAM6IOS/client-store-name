import { Injectable } from "@nestjs/common"
import { Prisma } from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import {
  InsufficientStockError,
  InvalidStockError,
  NotFoundError,
} from "../common/errors/domain-error"
import type {
  AdjustStockInput,
  ListInventoryQuery,
  ListMovementsQuery,
  ReleaseStockInput,
  ReserveStockInput,
} from "./dto/inventory.schemas"

export interface InventoryAvailability {
  inventoryItemId: string
  variantId: string
  sku: string | null
  stockedQuantity: number
  reservedQuantity: number
  availableQuantity: number
  allowBackorder: boolean
}

interface LockedItemRow {
  id: string
  stocked_quantity: number
  reserved_quantity: number
  allow_backorder: boolean
  sku: string | null
}

/**
 * Inventory reads and mutations. Every counter change:
 *   1. runs inside an interactive transaction,
 *   2. locks the `inventory_items` row with `SELECT ... FOR UPDATE` so
 *      concurrent requests serialise on the same row (ADR-0008),
 *   3. re-validates the invariant against the freshly locked values,
 *   4. appends exactly one `inventory_movements` ledger row.
 *
 * The database CHECK constraints are the final backstop; the service raises
 * typed domain errors so callers get useful 400/409 responses.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(query: ListInventoryQuery = { lowStock: false }) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    // `lowStock` = no sellable quantity left (available <= 0). Column-to-column
    // comparison is not expressible in the Prisma query API, so resolve ids first.
    let where: Prisma.InventoryItemWhereInput | undefined
    if (query.lowStock) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM inventory_items WHERE (stocked_quantity - reserved_quantity) <= 0
      `
      where = { id: { in: rows.map((row) => row.id) } }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({
        where,
        include: {
          variant: { include: { product: { select: { id: true, title: true, handle: true } } } },
        },
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ])

    return {
      data: items.map((item) => this.toAvailability(item)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  async getAvailabilityByVariant(variantId: string): Promise<InventoryAvailability> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { variant_id: variantId },
      include: { variant: true },
    })
    if (!item) throw new NotFoundError(`No inventory item for variant "${variantId}"`)
    return this.toAvailability(item)
  }

  async listMovements(variantId: string, query: ListMovementsQuery = {}) {
    const item = await this.requireItemByVariant(variantId)
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    const where: Prisma.InventoryMovementWhereInput = { inventory_item_id: item.id }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ])

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 }
  }

  /** Applies a signed stock adjustment (receipt / adjustment / return). */
  async adjustStock(variantId: string, input: AdjustStockInput, actor?: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await this.lockItem(tx, variantId)

      const newStocked = locked.stocked_quantity + input.quantity
      if (newStocked < 0) {
        throw new InvalidStockError(
          `Adjustment would make stocked quantity negative (${newStocked})`,
          { stocked: locked.stocked_quantity, delta: input.quantity },
        )
      }
      if (newStocked < locked.reserved_quantity) {
        throw new InvalidStockError(
          `Adjustment would drop stocked quantity (${newStocked}) below reserved (${locked.reserved_quantity})`,
          { stocked: newStocked, reserved: locked.reserved_quantity },
        )
      }

      return this.applyChange(tx, locked, {
        type: input.type,
        stockedDelta: input.quantity,
        reservedDelta: 0,
        stockedAfter: newStocked,
        reservedAfter: locked.reserved_quantity,
        reason: input.reason,
        reference: input.reference,
        actor,
      })
    })
  }

  /** Atomically reserves stock; blocks when availability is insufficient. */
  async reserveStock(variantId: string, input: ReserveStockInput, actor?: string) {
    return this.prisma.$transaction((tx) => this.reserveStockTx(tx, variantId, input, actor))
  }

  /**
   * Reserve inside a caller-owned transaction. Exposed so order flows can
   * combine a state change and its inventory effect atomically (ADR-0008).
   */
  async reserveStockTx(
    tx: Prisma.TransactionClient,
    variantId: string,
    input: ReserveStockInput,
    actor?: string,
  ) {
    const locked = await this.lockItem(tx, variantId)
    const available = locked.stocked_quantity - locked.reserved_quantity

    if (!locked.allow_backorder && available < input.quantity) {
      throw new InsufficientStockError(available, input.quantity, { variantId })
    }

    const newReserved = locked.reserved_quantity + input.quantity
    return this.applyChange(tx, locked, {
      type: "reservation",
      stockedDelta: 0,
      reservedDelta: input.quantity,
      stockedAfter: locked.stocked_quantity,
      reservedAfter: newReserved,
      reason: input.reason,
      reference: input.reference,
      actor,
    })
  }

  /** Releases previously reserved stock. */
  async releaseStock(variantId: string, input: ReleaseStockInput, actor?: string) {
    return this.prisma.$transaction((tx) => this.releaseStockTx(tx, variantId, input, actor))
  }

  /**
   * Release inside a caller-owned transaction (see `reserveStockTx`).
   */
  async releaseStockTx(
    tx: Prisma.TransactionClient,
    variantId: string,
    input: ReleaseStockInput,
    actor?: string,
  ) {
    const locked = await this.lockItem(tx, variantId)

    if (locked.reserved_quantity < input.quantity) {
      throw new InvalidStockError(
        `Cannot release ${input.quantity}; only ${locked.reserved_quantity} reserved`,
        { reserved: locked.reserved_quantity, requested: input.quantity },
      )
    }

    const newReserved = locked.reserved_quantity - input.quantity
    return this.applyChange(tx, locked, {
      type: "release",
      stockedDelta: 0,
      reservedDelta: -input.quantity,
      stockedAfter: locked.stocked_quantity,
      reservedAfter: newReserved,
      reason: input.reason,
      reference: input.reference,
      actor,
    })
  }

  // ───────────────────────────── Internals ─────────────────────────────

  private async applyChange(
    tx: Prisma.TransactionClient,
    locked: LockedItemRow,
    change: {
      type: "receipt" | "adjustment" | "return" | "reservation" | "release"
      stockedDelta: number
      reservedDelta: number
      stockedAfter: number
      reservedAfter: number
      reason?: string
      reference?: string
      actor?: string
    },
  ) {
    const updated = await tx.inventoryItem.update({
      where: { id: locked.id },
      data: {
        stocked_quantity: change.stockedAfter,
        reserved_quantity: change.reservedAfter,
      },
    })

    await tx.inventoryMovement.create({
      data: {
        inventory_item_id: locked.id,
        type: change.type,
        stocked_delta: change.stockedDelta,
        reserved_delta: change.reservedDelta,
        stocked_after: change.stockedAfter,
        reserved_after: change.reservedAfter,
        reason: change.reason,
        reference: change.reference,
        created_by: change.actor,
      },
    })

    return this.toAvailability({
      ...updated,
      variant: undefined,
      allow_backorder: locked.allow_backorder,
      sku: locked.sku,
    })
  }

  /**
   * Locks the inventory row for the duration of the transaction. In READ
   * COMMITTED, a waiting `FOR UPDATE` re-reads the latest committed row, so
   * the availability check below observes concurrent reservations.
   */
  private async lockItem(tx: Prisma.TransactionClient, variantId: string): Promise<LockedItemRow> {
    const rows = await tx.$queryRaw<LockedItemRow[]>`
      SELECT i.id,
             i.stocked_quantity,
             i.reserved_quantity,
             v.allow_backorder,
             v.sku
      FROM inventory_items i
      JOIN product_variants v ON v.id = i.variant_id
      WHERE i.variant_id = ${variantId}
      FOR UPDATE OF i
    `
    const row = rows[0]
    if (!row) throw new NotFoundError(`No inventory item for variant "${variantId}"`)
    return row
  }

  private async requireItemByVariant(variantId: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { variant_id: variantId } })
    if (!item) throw new NotFoundError(`No inventory item for variant "${variantId}"`)
    return item
  }

  private toAvailability(item: {
    id: string
    variant_id: string
    stocked_quantity: number
    reserved_quantity: number
    sku?: string | null
    allow_backorder?: boolean
    variant?: { sku: string | null; allow_backorder: boolean } | null
  }): InventoryAvailability {
    const sku = item.variant?.sku ?? item.sku ?? null
    const allowBackorder = item.variant?.allow_backorder ?? item.allow_backorder ?? false
    return {
      inventoryItemId: item.id,
      variantId: item.variant_id,
      sku,
      stockedQuantity: item.stocked_quantity,
      reservedQuantity: item.reserved_quantity,
      availableQuantity: item.stocked_quantity - item.reserved_quantity,
      allowBackorder,
    }
  }
}
