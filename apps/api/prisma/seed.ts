import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { COMMUNES, LEGACY_LOCATION_CODES, WILAYAS } from "../src/common/dz/locations"

const DELIVERY_RATES: Array<{
  wilaya_code: string
  method: "home" | "stop_desk"
  currency_code: string
  provider: string
  fee_amount: bigint
  label: string | null
}> = [
  {
    wilaya_code: "16",
    method: "home",
    currency_code: "DZD",
    provider: "",
    fee_amount: 800n,
    label: "Alger Centre - Home",
  },
  {
    wilaya_code: "16",
    method: "stop_desk",
    currency_code: "DZD",
    provider: "",
    fee_amount: 400n,
    label: "Alger Centre - Stop desk",
  },
  {
    wilaya_code: "09",
    method: "home",
    currency_code: "DZD",
    provider: "",
    fee_amount: 700n,
    label: "Blida - Home",
  },
  {
    wilaya_code: "09",
    method: "stop_desk",
    currency_code: "DZD",
    provider: "",
    fee_amount: 350n,
    label: "Blida - Stop desk",
  },
  {
    wilaya_code: "15",
    method: "home",
    currency_code: "DZD",
    provider: "",
    fee_amount: 850n,
    label: "Tizi Ouzou - Home",
  },
  {
    wilaya_code: "15",
    method: "stop_desk",
    currency_code: "DZD",
    provider: "",
    fee_amount: 400n,
    label: "Tizi Ouzou - Stop desk",
  },
]

/**
 * Baseline storefront categories. `slug` is unique, so re-seeding is
 * idempotent; `position` preserves the intended display order on the home page.
 */
const CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: "إلكترونيات", slug: "electronics" },
  { name: "هواتف وأجهزة لوحية", slug: "phones-tablets" },
  { name: "أزياء وملابس", slug: "fashion" },
  { name: "المنزل والمطبخ", slug: "home-kitchen" },
  { name: "الجمال والعناية", slug: "beauty" },
  { name: "الرياضة واللياقة", slug: "sports" },
  { name: "مستلزمات الأطفال", slug: "baby" },
  { name: "مواد غذائية", slug: "groceries" },
]

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is required to seed the database")
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

  try {
    const currencies = [
      { code: "DZD", name: "Algerian Dinar", minor_digits: 2, is_default: true },
      { code: "USD", name: "US Dollar", minor_digits: 2, is_default: false },
      { code: "EUR", name: "Euro", minor_digits: 2, is_default: false },
    ]
    for (const currency of currencies) {
      await prisma.currency.upsert({
        where: { code: currency.code },
        update: { name: currency.name, minor_digits: currency.minor_digits, is_active: true },
        create: { ...currency, is_active: true },
      })
    }
    await prisma.currency.updateMany({
      where: { is_default: true, code: { not: "DZD" } },
      data: { is_default: false },
    })
    await prisma.currency.update({ where: { code: "DZD" }, data: { is_default: true } })

    const settings = await prisma.storeSetting.findFirst()
    if (!settings) {
      await prisma.storeSetting.create({
        data: {
          name: "BITA Store",
          default_locale: "ar",
          base_currency: "DZD",
          cod_enabled: true,
          reservation_ttl_minutes: 60,
        },
      })
    }

    // Wilayas (69) - idempotent upsert; `position` preserves the dataset order.
    await prisma.$transaction(
      WILAYAS.map((w, index) =>
        prisma.wilaya.upsert({
          where: { code: w.code },
          update: {
            name_ar: w.name_ar,
            name_fr: w.name_fr,
            latitude: w.latitude,
            longitude: w.longitude,
            position: index + 1,
            is_active: true,
          },
          create: {
            code: w.code,
            name_ar: w.name_ar,
            name_fr: w.name_fr,
            latitude: w.latitude,
            longitude: w.longitude,
            position: index + 1,
            is_active: true,
          },
        }),
      ),
    )

    // Communes (1541) - reference data mirrored for integrity; replaced
    // atomically so a re-seed is deterministic and idempotent. Orders snapshot
    // the commune as text/post-code and never depend on these row ids.
    await prisma.$transaction([
      prisma.commune.deleteMany({}),
      prisma.commune.createMany({
        data: COMMUNES.map((c) => ({
          code: c.code,
          post_code: c.post_code,
          name_fr: c.name_fr,
          name_ar: c.name_ar,
          daira: c.daira,
          daira_ar: c.daira_ar,
          wilaya_code: c.wilaya_code,
          latitude: c.latitude,
          longitude: c.longitude,
          verification_status: c.verification_status,
          verification_note: c.verification_note,
          is_active: true,
        })),
      }),
    ])

    // Legacy/carrier code mappings (empty until verified carrier data is added).
    for (const mapping of LEGACY_LOCATION_CODES) {
      await prisma.legacyLocationCode.upsert({
        where: {
          provider_legacy_code: {
            provider: mapping.provider,
            legacy_code: mapping.legacy_code,
          },
        },
        update: {
          wilaya_code: mapping.wilaya_code,
          commune_code: mapping.commune_code,
          label: mapping.label,
        },
        create: {
          provider: mapping.provider,
          legacy_code: mapping.legacy_code,
          wilaya_code: mapping.wilaya_code,
          commune_code: mapping.commune_code,
          label: mapping.label,
        },
      })
    }

    for (const r of DELIVERY_RATES) {
      await prisma.deliveryRate.upsert({
        where: {
          wilaya_code_method_currency_code_provider: {
            wilaya_code: r.wilaya_code,
            method: r.method,
            currency_code: r.currency_code,
            provider: r.provider,
          },
        },
        update: { fee_amount: r.fee_amount, label: r.label, is_active: true },
        create: { ...r, is_active: true },
      })
    }

    // Baseline catalog categories (idempotent by unique slug).
    await prisma.$transaction(
      CATEGORIES.map((category, index) =>
        prisma.category.upsert({
          where: { slug: category.slug },
          update: { name: category.name, position: index + 1, is_active: true },
          create: {
            name: category.name,
            slug: category.slug,
            position: index + 1,
            is_active: true,
          },
        }),
      ),
    )

    console.log(
      `Seeded ${currencies.length} currencies, ${WILAYAS.length} wilayas, ${COMMUNES.length} communes, ${LEGACY_LOCATION_CODES.length} legacy codes, ${DELIVERY_RATES.length} delivery rates, ${CATEGORIES.length} categories`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
