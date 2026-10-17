import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import type { IdempotencyKey } from "../generated/prisma/client"
import { NotFoundError } from "../common/errors/domain-error"
import { ORDER_CREATION_SCOPE } from "./domain/order-policy"

export interface IdempotencyRecord {
  id: string
  orderId: string | null
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateKey(scope: string, key: string, requestHash?: string): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.upsert({
      where: { scope_key: { scope, key } },
      update: {},
      create: { scope, key, request_hash: requestHash ?? null },
    })
  }

  async getOrCreateOrderKey(key: string, requestHash?: string): Promise<IdempotencyKey> {
    return this.getOrCreateKey(ORDER_CREATION_SCOPE, key, requestHash)
  }

  async attachOrder(keyId: string, orderId: string): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { id: keyId },
      data: { order_id: orderId },
    })
  }

  async getOrderIdByKey(scope: string, key: string): Promise<string | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope, key } },
      select: { order_id: true },
    })
    return record?.order_id ?? null
  }
}