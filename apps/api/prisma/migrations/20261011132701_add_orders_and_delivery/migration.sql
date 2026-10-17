-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('home', 'stop_desk');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending_confirmation', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'delivery_failed', 'returned');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'shipped', 'delivered', 'failed', 'returned');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('cod_pending', 'cod_collected', 'cod_remitted');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('held', 'released', 'committed');

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'sale';

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "reservation_ttl_minutes" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "wilayas" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wilayas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_rates" (
    "id" TEXT NOT NULL,
    "wilaya_code" VARCHAR(2) NOT NULL,
    "method" "DeliveryMethod" NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "fee_amount" BIGINT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "display_id" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending_confirmation',
    "shipment_status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "collection_status" "CollectionStatus" NOT NULL DEFAULT 'cod_pending',
    "currency_code" VARCHAR(3) NOT NULL,
    "subtotal_amount" BIGINT NOT NULL,
    "shipping_amount" BIGINT NOT NULL,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "total_amount" BIGINT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "email" TEXT,
    "delivery_method" "DeliveryMethod" NOT NULL,
    "delivery_label" TEXT,
    "delivery_rate_id" TEXT,
    "wilaya_code" VARCHAR(2) NOT NULL,
    "wilaya_name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address_line" TEXT,
    "nearby_landmark" TEXT,
    "notes" TEXT,
    "tracking_token" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "product_title" TEXT NOT NULL,
    "variant_title" TEXT NOT NULL,
    "sku" TEXT,
    "options" JSONB,
    "quantity" INTEGER NOT NULL,
    "unit_amount" BIGINT NOT NULL,
    "line_amount" BIGINT NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "shipment_status" "ShipmentStatus",
    "note" TEXT,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "inventory_item_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'held',
    "expires_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT,
    "order_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wilayas_code_key" ON "wilayas"("code");

-- CreateIndex
CREATE INDEX "delivery_rates_method_is_active_idx" ON "delivery_rates"("method", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rates_wilaya_code_method_key" ON "delivery_rates"("wilaya_code", "method");

-- CreateIndex
CREATE UNIQUE INDEX "orders_display_id_key" ON "orders"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_token_key" ON "orders"("tracking_token");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_order_item_id_key" ON "inventory_reservations"("order_item_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_order_id_idx" ON "inventory_reservations"("order_id");

-- CreateIndex
CREATE INDEX "inventory_reservations_status_expires_at_idx" ON "inventory_reservations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "inventory_reservations_inventory_item_id_status_idx" ON "inventory_reservations"("inventory_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_order_id_key" ON "idempotency_keys"("order_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- AddForeignKey
ALTER TABLE "delivery_rates" ADD CONSTRAINT "delivery_rates_wilaya_code_fkey" FOREIGN KEY ("wilaya_code") REFERENCES "wilayas"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints (money invariants per ADR-0005; quantities and totals).
ALTER TABLE "delivery_rates"
    ADD CONSTRAINT "delivery_rates_fee_non_negative" CHECK ("fee_amount" >= 0);

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_amounts_non_negative"
        CHECK ("subtotal_amount" >= 0 AND "shipping_amount" >= 0 AND "discount_amount" >= 0 AND "total_amount" >= 0),
    ADD CONSTRAINT "orders_total_consistent"
        CHECK ("total_amount" = "subtotal_amount" + "shipping_amount" - "discount_amount"),
    ADD CONSTRAINT "orders_discount_not_exceed_subtotal"
        CHECK ("discount_amount" <= "subtotal_amount");

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
    ADD CONSTRAINT "order_items_amounts_non_negative" CHECK ("unit_amount" >= 0 AND "line_amount" >= 0),
    ADD CONSTRAINT "order_items_line_consistent" CHECK ("line_amount" = "unit_amount" * "quantity");

ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_quantity_positive" CHECK ("quantity" > 0);
