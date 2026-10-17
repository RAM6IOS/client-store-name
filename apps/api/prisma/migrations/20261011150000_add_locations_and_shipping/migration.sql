-- CreateEnum
CREATE TYPE "LocationReviewStatus" AS ENUM ('verified', 'spelling_variant', 'unmatched', 'unchecked');

-- DropIndex
DROP INDEX "delivery_rates_wilaya_code_method_key";

-- AlterTable
ALTER TABLE "delivery_rates" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "commune_code" TEXT,
ADD COLUMN     "delivery_quote_expires_at" TIMESTAMP(3),
ADD COLUMN     "delivery_quote_issued_at" TIMESTAMP(3),
ADD COLUMN     "delivery_quote_provider" TEXT,
ADD COLUMN     "delivery_quote_snapshot" JSONB,
ADD COLUMN     "stop_desk_address" TEXT,
ADD COLUMN     "stop_desk_id" TEXT,
ADD COLUMN     "stop_desk_name" TEXT,
ADD COLUMN     "stop_desk_provider" TEXT;

-- AlterTable
ALTER TABLE "wilayas" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "communes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "post_code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "daira" TEXT,
    "daira_ar" TEXT,
    "wilaya_code" VARCHAR(2) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "verification_status" "LocationReviewStatus" NOT NULL DEFAULT 'unchecked',
    "verification_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_location_codes" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "legacy_code" TEXT NOT NULL,
    "wilaya_code" VARCHAR(2),
    "commune_code" TEXT,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_location_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communes_code_key" ON "communes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "communes_post_code_key" ON "communes"("post_code");

-- CreateIndex
CREATE INDEX "communes_wilaya_code_idx" ON "communes"("wilaya_code");

-- CreateIndex
CREATE INDEX "communes_name_fr_idx" ON "communes"("name_fr");

-- CreateIndex
CREATE INDEX "communes_is_active_idx" ON "communes"("is_active");

-- CreateIndex
CREATE INDEX "legacy_location_codes_wilaya_code_idx" ON "legacy_location_codes"("wilaya_code");

-- CreateIndex
CREATE INDEX "legacy_location_codes_commune_code_idx" ON "legacy_location_codes"("commune_code");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_location_codes_provider_legacy_code_key" ON "legacy_location_codes"("provider", "legacy_code");

-- CreateIndex
CREATE INDEX "delivery_rates_provider_is_active_idx" ON "delivery_rates"("provider", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rates_wilaya_code_method_currency_code_provider_key" ON "delivery_rates"("wilaya_code", "method", "currency_code", "provider");

-- CreateIndex
CREATE INDEX "wilayas_is_active_idx" ON "wilayas"("is_active");

-- AddForeignKey
ALTER TABLE "communes" ADD CONSTRAINT "communes_wilaya_code_fkey" FOREIGN KEY ("wilaya_code") REFERENCES "wilayas"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_location_codes" ADD CONSTRAINT "legacy_location_codes_wilaya_code_fkey" FOREIGN KEY ("wilaya_code") REFERENCES "wilayas"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_location_codes" ADD CONSTRAINT "legacy_location_codes_commune_code_fkey" FOREIGN KEY ("commune_code") REFERENCES "communes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

