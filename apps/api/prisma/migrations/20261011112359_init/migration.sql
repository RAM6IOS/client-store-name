-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_locale" TEXT NOT NULL DEFAULT 'ar',
    "base_currency" VARCHAR(3) NOT NULL DEFAULT 'dzd',
    "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "minor_digits" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);
