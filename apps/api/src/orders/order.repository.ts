import { Injectable } from "@nestjs/common"
import { Prisma } from "../generated/prisma/client"
import type { ProductVariant } from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { InvalidStockError, NotFoundError } from "../common/errors/domain-error"
import { parsePriceMinorUnits } from "./domain/order-totals"

export interface VariantSnapshot {
  variant_id: string
  product_id: string
  product_title: string
  variant_title: string
  sku: string | null
  currency_code: string
  price_amount: bigint
  manage_inventory: boolean
  allow_backorder: boolean
}

export interface LineCandidate {
  variant_id: string
  quantity: number
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getVariantsForCheckout(
    currencyCode: string,
    candidates: LineCandidate[],
  ): Promise<Map<string, VariantSnapshot & { currency_minor_digits: number }>> {
    if (candidates.length === 0) return new Map()
    const ids = candidates.map((c) => c.variant_id)
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { id: true, title: true } }, inventory_item: true },
    })
    const found = new Set(variants.map((v) => v.id))
    for (const c of candidates) {
      if (!found.has(c.variant_id)) throw new NotFoundError(`Variant "${c.variant_id}" not found`)
    }
    const currency = await this.prisma.currency.findUnique({ where: { code: currencyCode.toUpperCase() } })
    if (!currency) throw new NotFoundError(`Currency "${currencyCode}" not found`)

    const map = new Map<string, VariantSnapshot & { currency_minor_digits: number }>()
    for (const v of variants) {
      map.set(v.id, {
        variant_id: v.id,
        product_id: v.product_id,
        product_title: v.product.title,
        variant_title: v.title,
        sku: v.sku,
        currency_code: v.currency_code,
        price_amount: v.price_amount,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
        currency_minor_digits: currency.minor_digits,
      })
    }
    return map
  }
}