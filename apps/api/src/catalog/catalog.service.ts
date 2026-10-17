import { Injectable } from "@nestjs/common"
import { Prisma } from "../generated/prisma/client"
import type { Currency, ProductImage, ProductVariant } from "../generated/prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import {
  ConflictError,
  DuplicateHandleError,
  DuplicateSlugError,
  HistoryExistsError,
  InvalidImageError,
  InvalidPriceError,
  NotFoundError,
  UnknownCurrencyError,
} from "../common/errors/domain-error"
import { assertNonNegativeMinorUnits, parseDecimalToMinorUnits } from "../common/money/money"
import { MAX_IMAGES_PER_PRODUCT, MediaService } from "../media/media.service"
import type {
  CategoryRefInput,
  CreateCategoryInput,
  CreateProductInput,
  ImageInput,
  ProductOptionInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
  VariantInput,
} from "./dto/catalog.schemas"

/** Minimal shape of a multipart file at the service boundary. */
export interface UploadedImageFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

const productInclude = {
  images: { orderBy: { rank: "asc" } },
  categories: { include: { category: true }, orderBy: { position: "asc" } },
  options: { orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } } } },
  variants: {
    orderBy: { position: "asc" },
    include: {
      inventory_item: true,
      option_values: {
        include: {
          option: true,
          option_value: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude

type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productInclude }>

interface VariantDraft {
  title: string
  sku?: string
  position?: number
  is_default?: boolean
  is_active?: boolean
  price_amount?: bigint
  price?: string
  compare_at_amount?: bigint | null
  compare_at_price?: string | null
  currency_code?: string
  manage_inventory?: boolean
  allow_backorder?: boolean
  initial_stock?: number
}

interface ResolvedVariant {
  title: string
  sku?: string
  position: number
  is_default: boolean
  is_active?: boolean
  amount: bigint
  /** `undefined` leaves compare-at untouched, `null` clears it, a bigint sets it. */
  compareAt: bigint | null | undefined
  currencyCode: string
  manageInventory: boolean
  allowBackorder: boolean
  initialStock: number
}

export interface ListProductsResult {
  data: ProductDetail[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // ───────────────────────────── Products ─────────────────────────────

  async createProduct(input: CreateProductInput, actor?: string): Promise<ProductDetail> {
    const handle = input.handle ?? (await this.generateUniqueHandle(input.title))
    if (input.handle && (await this.productHandleExists(handle))) {
      throw new DuplicateHandleError(handle)
    }

    if (input.options && input.options.length > 0) {
      const cache = new Map<string, Currency>()
      const currencyCode = input.currency_code
      if (!currencyCode) {
        throw new InvalidPriceError("Currency code is required for variant products")
      }
      const currency = await this.getCurrency(currencyCode, cache)
      const amount = this.resolveAmount(input, currency)

      try {
        const product = await this.prisma.product.create({
          data: {
            title: input.title,
            description: input.description,
            handle,
            status: input.status ?? "draft",
            thumbnail: input.thumbnail,
            is_featured: input.is_featured ?? false,
            images: input.images?.length
              ? { create: input.images.map((image, index) => this.toImageCreate(image, index)) }
              : undefined,
            categories: input.categories?.length
              ? {
                  create: input.categories.map((category) => ({
                    category_id: category.category_id,
                    position: category.position ?? 0,
                  })),
                }
              : undefined,
          },
          include: productInclude,
        })

        await this.generateVariants(product.id, input.options, actor, input.variants)
        return this.getProduct(product.id)
      } catch (error) {
        throw this.mapWriteError(error, { handle })
      }
    }

    const cache = new Map<string, Currency>()
    const drafts: VariantDraft[] =
      input.variants && input.variants.length > 0
        ? input.variants
        : [
            {
              title: "Default",
              sku: input.sku,
              is_default: true,
              price_amount: input.price_amount,
              price: input.price,
              compare_at_amount: input.compare_at_amount,
              compare_at_price: input.compare_at_price,
              currency_code: input.currency_code,
              initial_stock: input.initial_stock ?? 0,
            },
          ]

    const resolvedVariants = await this.resolveVariants(drafts, input.currency_code, cache)

    try {
      return await this.prisma.product.create({
        data: {
          title: input.title,
          description: input.description,
          handle,
          status: input.status ?? "draft",
          thumbnail: input.thumbnail,
          is_featured: input.is_featured ?? false,
          images: input.images?.length
            ? { create: input.images.map((image, index) => this.toImageCreate(image, index)) }
            : undefined,
          categories: input.categories?.length
            ? {
                create: input.categories.map((category) => ({
                  category_id: category.category_id,
                  position: category.position ?? 0,
                })),
              }
            : undefined,
          variants: {
            create: resolvedVariants.map((variant) => this.toVariantCreate(variant, actor)),
          },
        },
        include: productInclude,
      })
    } catch (error) {
      throw this.mapWriteError(error, { handle })
    }
  }

  async listProducts(query: {
    page?: number
    pageSize?: number
    status?: string
    category?: string
    search?: string
    featured?: boolean
  }): Promise<ListProductsResult> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    const where: Prisma.ProductWhereInput = {}
    if (query.status) where.status = query.status as Prisma.ProductWhereInput["status"]
    if (query.featured !== undefined) where.is_featured = query.featured
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { handle: { contains: query.search, mode: "insensitive" } },
        // Search by SKU so the admin product list is usable from a SKU alone.
        // SKUs are stored upper-case; matching is insensitive for convenience.
        { variants: { some: { sku: { contains: query.search, mode: "insensitive" } } } },
      ]
    }
    if (query.category) {
      where.categories = {
        some: { category: { OR: [{ id: query.category }, { slug: query.category }] } },
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ])

    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 }
  }

  async getProduct(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude })
    if (!product) throw new NotFoundError(`Product "${id}" not found`)
    return product
  }

  /** Public storefront lookup by the human-readable handle (the URL slug). */
  async getProductByHandle(handle: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({ where: { handle }, include: productInclude })
    if (!product) throw new NotFoundError(`Product "${handle}" not found`)
    return product
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductDetail> {
    await this.ensureProductExists(id)
    if (input.handle) {
      const existing = await this.prisma.product.findUnique({ where: { handle: input.handle } })
      if (existing && existing.id !== id) throw new DuplicateHandleError(input.handle)
    }
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          handle: input.handle,
          status: input.status,
          thumbnail: input.thumbnail,
          is_featured: input.is_featured,
        },
      })

      if (input.categories !== undefined) {
        await this.replaceProductCategories(id, input.categories)
      }

      if (input.options !== undefined) {
        if (input.options.length === 0) {
          await this.revertToSimpleProduct(id)
        } else {
          const product = await this.getProduct(id)
          const optionsChanged = this.optionsHaveChanged(product.options, input.options)
          if (!optionsChanged && input.variants && input.variants.length > 0) {
            await this.updateExistingVariants(id, input.variants)
          } else {
            await this.generateVariants(id, input.options, undefined, input.variants)
          }
        }
      } else if (input.variants !== undefined && input.variants.length > 0) {
        await this.updateExistingVariants(id, input.variants)
      }

      // Applied last so a variant rewrite above cannot clobber it.
      if (input.compare_at_amount !== undefined || input.compare_at_price !== undefined) {
        await this.applyDefaultVariantCompareAt(id, input.compare_at_amount, input.compare_at_price)
      }

      return this.getProduct(id)
    } catch (error) {
      throw this.mapWriteError(error, { handle: input.handle })
    }
  }

  /**
   * Replaces a product's category links with the submitted set. An empty array
   * detaches the product from every category. Runs atomically so a product is
   * never left without its previous links on failure.
   */
  private async replaceProductCategories(
    productId: string,
    categories: CategoryRefInput[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.productCategory.deleteMany({ where: { product_id: productId } }),
      ...(categories.length > 0
        ? [
            this.prisma.productCategory.createMany({
              data: categories.map((category, index) => ({
                product_id: productId,
                category_id: category.category_id,
                position: category.position ?? index,
              })),
            }),
          ]
        : []),
    ])
  }

  async generateVariants(
    productId: string,
    options: ProductOptionInput[],
    actor?: string,
    submittedVariants?: VariantInput[],
  ): Promise<ProductDetail> {
    const product = await this.getProduct(productId)

    const preservationMap = new Map<string, {
      price_amount: bigint
      compare_at_amount: bigint | null
      currency_code: string
      sku: string | null
      image: string | null
      is_active: boolean
      manage_inventory: boolean
      allow_backorder: boolean
      stocked_quantity: number
    }>()

    for (const v of product.variants) {
      const sigParts = v.option_values.map((ov) => `${ov.option.title}:${ov.option_value.value}`).sort()
      if (sigParts.length > 0) {
        const sig = sigParts.join("::")
        preservationMap.set(sig, {
          price_amount: v.price_amount,
          compare_at_amount: v.compare_at_amount,
          currency_code: v.currency_code,
          sku: v.sku,
          image: v.image,
          is_active: v.is_active,
          manage_inventory: v.manage_inventory,
          allow_backorder: v.allow_backorder,
          stocked_quantity: v.inventory_item?.stocked_quantity ?? 0,
        })
      }
    }

    const combinations = this.generateCombinations(options)
    const fallbackCurrency = product.variants[0]?.currency_code ?? "DZD"
    const fallbackAmount = product.variants[0]?.price_amount ?? 0n

    const cache = new Map<string, Currency>()
    const submittedMap = new Map<string, ResolvedVariant>()
    let resolvedSubmitted: ResolvedVariant[] = []
    if (submittedVariants && submittedVariants.length > 0) {
      resolvedSubmitted = await this.resolveVariants(submittedVariants, fallbackCurrency, cache)
      for (const sv of resolvedSubmitted) {
        submittedMap.set(sv.title.trim(), sv)
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productOption.deleteMany({ where: { product_id: productId } })

      const createdOptions = await Promise.all(
        options.map((opt, optIndex) =>
          tx.productOption.create({
            data: {
              product_id: productId,
              title: opt.title,
              position: opt.position ?? optIndex,
              values: {
                create: opt.values.map((val, valIndex) => ({
                  value: val.value,
                  position: val.position ?? valIndex,
                })),
              },
            },
            include: { values: true },
          })
        )
      )

      const optionIdMap = new Map<string, string>()
      const optionValueIdMap = new Map<string, string>()
      for (const opt of createdOptions) {
        optionIdMap.set(opt.title, opt.id)
        for (const val of opt.values) {
          optionValueIdMap.set(`${opt.title}:${val.value}`, val.id)
        }
      }

      const existingVariants = await tx.productVariant.findMany({
        where: { product_id: productId },
        include: { option_values: { include: { option: true, option_value: true } } },
      })

      const existingVariantIds = existingVariants.map((v) => v.id)
      const referencedVariants = existingVariantIds.length > 0
        ? await tx.orderItem.findMany({
            where: { variant_id: { in: existingVariantIds } },
            select: { variant_id: true },
          })
        : []
      const referencedVariantSet = new Set(referencedVariants.map((item) => item.variant_id))

      for (const ev of existingVariants) {
        if (referencedVariantSet.has(ev.id)) {
          await tx.productVariant.update({
            where: { id: ev.id },
            data: { is_active: false },
          })
        } else {
          await tx.productVariant.delete({ where: { id: ev.id } })
        }
      }

      for (const [index, combo] of combinations.entries()) {
        const submittedByIndex = resolvedSubmitted[index]
        const submittedByTitle = submittedMap.get(combo.title.trim())
        const submitted = submittedByIndex ?? submittedByTitle
        const preserved = preservationMap.get(combo.signature)

        const priceAmount = submitted?.amount ?? preserved?.price_amount ?? fallbackAmount
        // Prefer the compare-at submitted for this variant; fall back to the one
        // preserved from a variant with the same option signature. `undefined`
        // means the caller did not send a value, `null` means "no discount".
        const compareAtAmount =
          submitted?.compareAt !== undefined
            ? submitted.compareAt
            : preserved?.compare_at_amount ?? null
        const currencyCode = submitted?.currencyCode ?? preserved?.currency_code ?? fallbackCurrency
        const sku = submitted?.sku ?? preserved?.sku ?? undefined
        const image = preserved?.image ?? undefined
        const isActive = submitted?.is_active ?? preserved?.is_active ?? true
        const manageInventory = preserved?.manage_inventory ?? true
        const allowBackorder = preserved?.allow_backorder ?? false
        const initialStock = submitted?.initialStock ?? preserved?.stocked_quantity ?? 0

        const isDefault = index === 0

        await tx.productVariant.create({
          data: {
            product_id: productId,
            title: combo.title,
            position: index,
            is_default: isDefault,
            is_active: isActive,
            image,
            price_amount: priceAmount,
            compare_at_amount: compareAtAmount,
            currency_code: currencyCode,
            sku,
            manage_inventory: manageInventory,
            allow_backorder: allowBackorder,
            option_values: {
              create: combo.values.map((v) => ({
                option_id: optionIdMap.get(v.optionTitle)!,
                option_value_id: optionValueIdMap.get(`${v.optionTitle}:${v.value}`)!,
              })),
            },
            inventory_item: manageInventory
              ? {
                  create: {
                    stocked_quantity: initialStock,
                    reserved_quantity: 0,
                  },
                }
              : undefined,
          },
        })
      }
    })

    return this.getProduct(productId)
  }

  async updateExistingVariants(productId: string, variants: VariantInput[]): Promise<void> {
    const product = await this.getProduct(productId)
    const fallbackCurrency = product.variants[0]?.currency_code ?? "DZD"
    const cache = new Map<string, Currency>()
    const resolved = await this.resolveVariants(variants, fallbackCurrency, cache)

    await this.prisma.$transaction(async (tx) => {
      for (const [index, rv] of resolved.entries()) {
        const existing = product.variants[index] ?? product.variants.find((v) => v.title === rv.title)
        if (existing) {
          await tx.productVariant.update({
            where: { id: existing.id },
            data: {
              title: rv.title,
              sku: rv.sku,
              price_amount: rv.amount,
              // Compare-at is per variant: `undefined` keeps the stored value,
              // `null` clears it, a value sets it. This keeps each variant's
              // discount independent from its siblings.
              compare_at_amount:
                rv.compareAt === undefined ? existing.compare_at_amount : rv.compareAt,
              currency_code: rv.currencyCode,
              is_active: rv.is_active ?? true,
            },
          })
          if (existing.inventory_item) {
            await tx.inventoryItem.update({
              where: { id: existing.inventory_item.id },
              data: {
                stocked_quantity: rv.initialStock,
              },
            })
          } else if (rv.manageInventory) {
            await tx.inventoryItem.create({
              data: {
                variant_id: existing.id,
                stocked_quantity: rv.initialStock,
                reserved_quantity: 0,
              },
            })
          }
        }
      }
    })
  }

  /**
   * Sets (or clears) the compare-at amount on the product's default variant.
   * `compareAtAmount` is already in minor units; `compareAtPrice` is a decimal
   * in major units. An explicit `null` clears the value, `undefined` leaves it
   * untouched. The storefront admin edits prices per product, so the default
   * variant is the one the product card and detail page read.
   */
  private async applyDefaultVariantCompareAt(
    productId: string,
    compareAtAmount: bigint | null | undefined,
    compareAtPrice: string | null | undefined,
  ): Promise<void> {
    const product = await this.getProduct(productId)
    const variant = product.variants.find((v) => v.is_default) ?? product.variants[0]
    if (!variant) return

    let amount: bigint | null
    if (compareAtAmount !== undefined) {
      amount =
        compareAtAmount === null
          ? null
          : assertNonNegativeMinorUnits(compareAtAmount, "compare_at_amount")
    } else if (compareAtPrice !== undefined) {
      if (compareAtPrice === null) {
        amount = null
      } else {
        const currency = await this.requireCurrency(variant.currency_code)
        amount = parseDecimalToMinorUnits(compareAtPrice, currency.minor_digits)
      }
    } else {
      return
    }

    await this.prisma.productVariant.update({
      where: { id: variant.id },
      data: { compare_at_amount: amount },
    })
  }

  private optionsHaveChanged(
    existingOptions: { title: string; values: { value: string }[] }[],
    newOptions: ProductOptionInput[],
  ): boolean {
    if (existingOptions.length !== newOptions.length) return true
    for (let i = 0; i < existingOptions.length; i++) {
      const ext = existingOptions[i]
      const nxt = newOptions[i]
      if (ext.title !== nxt.title) return true
      const extVals = ext.values.map((v: { value: string }) => v.value).sort()
      const nxtVals = nxt.values.map((v: { value: string }) => v.value).sort()
      if (extVals.length !== nxtVals.length) return true
      for (let j = 0; j < extVals.length; j++) {
        if (extVals[j] !== nxtVals[j]) return true
      }
    }
    return false
  }

  private generateCombinations(options: ProductOptionInput[]): {
    title: string
    signature: string
    values: { optionTitle: string; value: string }[]
  }[] {
    if (!options || options.length === 0) return []
    const optionArrays = options.map((opt) =>
      opt.values.map((v) => ({ optionTitle: opt.title, value: v.value }))
    )
    const cartesian = optionArrays.reduce<({ optionTitle: string; value: string }[][])>(
      (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
      [[]]
    )
    return cartesian.map((combo) => {
      const title = combo.map((c) => c.value).join(" / ")
      const signature = combo
        .map((c) => `${c.optionTitle}:${c.value}`)
        .sort()
        .join("::")
      return { title, signature, values: combo }
    })
  }

  private async revertToSimpleProduct(productId: string): Promise<void> {
    const product = await this.getProduct(productId)
    const fallbackCurrency = product.variants[0]?.currency_code ?? "DZD"
    const fallbackAmount = product.variants[0]?.price_amount ?? 0n
    const fallbackStock = product.variants[0]?.inventory_item?.stocked_quantity ?? 0

    await this.prisma.$transaction(async (tx) => {
      await tx.productOption.deleteMany({ where: { product_id: productId } })

      const existingVariants = await tx.productVariant.findMany({
        where: { product_id: productId },
        select: { id: true },
      })
      const variantIds = existingVariants.map((v) => v.id)
      const referenced = variantIds.length > 0
        ? await tx.orderItem.findMany({
            where: { variant_id: { in: variantIds } },
            select: { variant_id: true },
          })
        : []
      const referencedSet = new Set(referenced.map((item) => item.variant_id))

      for (const ev of existingVariants) {
        if (referencedSet.has(ev.id)) {
          await tx.productVariant.update({ where: { id: ev.id }, data: { is_active: false } })
        } else {
          await tx.productVariant.delete({ where: { id: ev.id } })
        }
      }

      const activeVariants = await tx.productVariant.findMany({
        where: { product_id: productId, is_active: true },
      })
      if (activeVariants.length === 0) {
        await tx.productVariant.create({
          data: {
            product_id: productId,
            title: "Default",
            is_default: true,
            price_amount: fallbackAmount,
            currency_code: fallbackCurrency,
            inventory_item: {
              create: {
                stocked_quantity: fallbackStock,
                reserved_quantity: 0,
              },
            },
          },
        })
      }
    })
  }

  async deleteProduct(id: string): Promise<{ id: string; deleted: true }> {
    await this.ensureProductExists(id)
    await this.ensureNoOrderHistory(id)
    const images = await this.prisma.productImage.findMany({
      where: { product_id: id },
      select: { url: true },
    })
    await this.prisma.product.delete({ where: { id } })
    // Cascade removed the image rows; clean up their files best-effort so
    // deleting a product does not leak orphaned uploads.
    await Promise.allSettled(images.map((image) => this.media.removeByUrl(image.url)))
    return { id, deleted: true }
  }

  // ───────────────────────────── Variants ─────────────────────────────

  async addVariant(
    productId: string,
    input: VariantInput,
    actor?: string,
  ): Promise<ProductVariant> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          select: { currency_code: true, position: true },
          orderBy: { position: "desc" },
        },
      },
    })
    if (!product) throw new NotFoundError(`Product "${productId}" not found`)

    const siblingCurrency = product.variants[0]?.currency_code
    const nextPosition = (product.variants[0]?.position ?? -1) + 1
    const [resolved] = await this.resolveVariants(
      [{ ...input, position: input.position ?? nextPosition }],
      input.currency_code ?? siblingCurrency,
      new Map(),
    )

    try {
      return await this.prisma.productVariant.create({
        data: {
          ...this.toVariantCreate(resolved, actor),
          product: { connect: { id: productId } },
        },
        include: { inventory_item: true },
      })
    } catch (error) {
      throw this.mapWriteError(error)
    }
  }

  async updateVariant(id: string, input: UpdateVariantInput): Promise<ProductDetail> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id } })
    if (!variant) throw new NotFoundError(`Variant "${id}" not found`)

    const currencyCode = input.currency_code ?? variant.currency_code
    const currency = await this.requireCurrency(currencyCode)

    let amount: bigint | undefined
    if (input.price_amount !== undefined) {
      amount = assertNonNegativeMinorUnits(input.price_amount, "price_amount")
    } else if (input.price !== undefined) {
      amount = assertNonNegativeMinorUnits(
        parseDecimalToMinorUnits(input.price, currency.minor_digits),
        "price",
      )
    }

    let compareAt: bigint | null | undefined
    if (input.compare_at_amount !== undefined) {
      compareAt =
        input.compare_at_amount === null
          ? null
          : assertNonNegativeMinorUnits(input.compare_at_amount, "compare_at_amount")
    } else if (input.compare_at_price !== undefined) {
      compareAt =
        input.compare_at_price === null
          ? null
          : parseDecimalToMinorUnits(input.compare_at_price, currency.minor_digits)
    }

    try {
      await this.prisma.productVariant.update({
        where: { id },
        data: {
          title: input.title,
          sku: input.sku,
          position: input.position,
          is_default: input.is_default,
          manage_inventory: input.manage_inventory,
          allow_backorder: input.allow_backorder,
          currency_code: input.currency_code ? currencyCode : undefined,
          price_amount: amount,
          compare_at_amount: compareAt,
        },
      })
    } catch (error) {
      throw this.mapWriteError(error)
    }

    return this.getProduct(variant.product_id)
  }

  async deleteVariant(id: string): Promise<{ id: string; deleted: true; productId: string }> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id } })
    if (!variant) throw new NotFoundError(`Variant "${id}" not found`)
    const referenced = await this.prisma.orderItem.findFirst({
      where: { variant_id: variant.id },
      select: { id: true },
    })
    if (referenced) {
      throw new HistoryExistsError(
        `Variant "${variant.title}" (${variant.id}) is referenced by order history; archive the product instead`,
        { variant_id: variant.id },
      )
    }
    await this.prisma.productVariant.delete({ where: { id } })
    return { id, deleted: true, productId: variant.product_id }
  }

  // ───────────────────────────── Images ─────────────────────────────

  async addImage(productId: string, input: ImageInput): Promise<ProductImage> {
    await this.ensureProductExists(productId)
    const count = await this.prisma.productImage.count({ where: { product_id: productId } })
    return this.prisma.productImage.create({
      data: {
        ...this.toImageCreate(input, input.rank ?? count),
        product: { connect: { id: productId } },
      },
    })
  }

  async deleteImage(imageId: string): Promise<{ id: string; deleted: true; productId: string }> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } })
    if (!image) throw new NotFoundError(`Image "${imageId}" not found`)
    await this.prisma.productImage.delete({ where: { id: imageId } })
    // Uploaded files are removed from disk; externally-hosted URLs are ignored.
    await this.media.removeByUrl(image.url)
    return { id: imageId, deleted: true, productId: image.product_id }
  }

  /**
   * Persists a batch of uploaded images for a product. All files are validated
   * for their real content *before* anything is written, so a rejected batch
   * never leaves partial files or rows behind.
   */
  async uploadImages(
    productId: string,
    files: UploadedImageFile[],
    baseUrl: string,
  ): Promise<ProductImage[]> {
    await this.ensureProductExists(productId)
    if (files.length === 0) {
      throw new InvalidImageError("No images were received", { reason: "empty" })
    }

    for (const file of files) {
      this.media.validateImage(file.buffer, file.originalname)
    }

    const existing = await this.prisma.productImage.count({ where: { product_id: productId } })
    if (existing + files.length > MAX_IMAGES_PER_PRODUCT) {
      throw new ConflictError(
        `A product can hold at most ${MAX_IMAGES_PER_PRODUCT} images`,
        "IMAGE_COUNT_EXCEEDED",
        { existing, requested: files.length, max: MAX_IMAGES_PER_PRODUCT },
      )
    }

    const saved = await Promise.all(
      files.map((file) => this.media.saveImage(file.buffer, file.originalname)),
    )

    try {
      return await this.prisma.$transaction(
        saved.map((file, index) =>
          this.prisma.productImage.create({
            data: {
              url: this.media.toPublicUrl(file.key, baseUrl),
              rank: existing + index,
              product: { connect: { id: productId } },
            },
          }),
        ),
      )
    } catch (error) {
      await Promise.allSettled(saved.map((file) => this.media.removeByKey(file.key)))
      throw error
    }
  }

  // ──────────────────────────── Categories ────────────────────────────

  async createCategory(input: CreateCategoryInput) {
    const slug = input.slug ?? (this.slugify(input.name) || "category")
    if (input.slug && (await this.prisma.category.findUnique({ where: { slug } }))) {
      throw new DuplicateSlugError(slug)
    }
    const uniqueSlug = input.slug ? slug : await this.generateUniqueSlug(slug)

    if (input.parent_id) await this.ensureCategoryExists(input.parent_id)

    return this.prisma.category.create({
      data: {
        name: input.name,
        slug: uniqueSlug,
        description: input.description,
        parent_id: input.parent_id ?? null,
        position: input.position ?? 0,
        is_active: input.is_active ?? true,
      },
    })
  }

  async listCategories(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true, children: true } } },
    })
  }

  async getCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true, _count: { select: { products: true } } },
    })
    if (!category) throw new NotFoundError(`Category "${id}" not found`)
    return category
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    await this.ensureCategoryExists(id)
    if (input.slug) {
      const existing = await this.prisma.category.findUnique({ where: { slug: input.slug } })
      if (existing && existing.id !== id) throw new DuplicateSlugError(input.slug)
    }
    if (input.parent_id) {
      if (input.parent_id === id) throw new InvalidPriceError("A category cannot be its own parent")
      await this.ensureCategoryExists(input.parent_id)
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          parent_id: input.parent_id,
          position: input.position,
          is_active: input.is_active,
        },
      })
    } catch (error) {
      throw this.mapWriteError(error)
    }
  }

  async deleteCategory(id: string): Promise<{ id: string; deleted: true }> {
    await this.ensureCategoryExists(id)
    await this.prisma.category.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private async resolveVariants(
    drafts: VariantDraft[],
    fallbackCurrency: string | undefined,
    cache: Map<string, Currency>,
  ): Promise<ResolvedVariant[]> {
    const resolved: ResolvedVariant[] = []
    for (const [index, draft] of drafts.entries()) {
      const currencyCode = draft.currency_code ?? fallbackCurrency
      if (!currencyCode) {
        throw new InvalidPriceError(
          `Variant at position ${index} has no currency_code and no product-level currency was supplied`,
        )
      }
      const currency = await this.getCurrency(currencyCode, cache)
      const amount = this.resolveAmount(draft, currency)
      const compareAt =
        draft.compare_at_amount !== undefined
          ? draft.compare_at_amount === null
            ? null
            : assertNonNegativeMinorUnits(draft.compare_at_amount, "compare_at_amount")
          : draft.compare_at_price !== undefined
            ? draft.compare_at_price === null
              ? null
              : parseDecimalToMinorUnits(draft.compare_at_price, currency.minor_digits)
            : undefined

      resolved.push({
        title: draft.title,
        sku: draft.sku,
        position: draft.position ?? index,
        is_default: draft.is_default ?? (drafts.length === 1 && index === 0),
        amount,
        compareAt,
        currencyCode: currency.code,
        manageInventory: draft.manage_inventory ?? true,
        allowBackorder: draft.allow_backorder ?? false,
        initialStock: draft.initial_stock ?? 0,
      })
    }
    return resolved
  }

  private resolveAmount(
    draft: Pick<VariantDraft, "price_amount" | "price">,
    currency: Currency,
  ): bigint {
    if (draft.price_amount !== undefined) {
      return assertNonNegativeMinorUnits(draft.price_amount, "price_amount")
    }
    if (draft.price !== undefined) {
      return assertNonNegativeMinorUnits(
        parseDecimalToMinorUnits(draft.price, currency.minor_digits),
        "price",
      )
    }
    throw new InvalidPriceError(
      "A price is required (price_amount in minor units, or price as a decimal)",
    )
  }

  private async getCurrency(code: string, cache: Map<string, Currency>): Promise<Currency> {
    const cached = cache.get(code)
    if (cached) return cached
    const currency = await this.requireCurrency(code)
    cache.set(code, currency)
    return currency
  }

  private async requireCurrency(code: string): Promise<Currency> {
    const currency = await this.prisma.currency.findUnique({ where: { code } })
    if (!currency || !currency.is_active) throw new UnknownCurrencyError(code)
    return currency
  }

  private toVariantCreate(
    variant: ResolvedVariant,
    actor?: string,
  ): Prisma.ProductVariantCreateWithoutProductInput {
    return {
      title: variant.title,
      sku: variant.sku,
      position: variant.position,
      is_default: variant.is_default,
      price_amount: variant.amount,
      compare_at_amount: variant.compareAt ?? null,
      currency_code: variant.currencyCode,
      manage_inventory: variant.manageInventory,
      allow_backorder: variant.allowBackorder,
      inventory_item: variant.manageInventory
        ? {
            create: {
              stocked_quantity: variant.initialStock,
              reserved_quantity: 0,
              movements:
                variant.initialStock > 0
                  ? {
                      create: [
                        {
                          type: "receipt" as const,
                          stocked_delta: variant.initialStock,
                          reserved_delta: 0,
                          stocked_after: variant.initialStock,
                          reserved_after: 0,
                          reason: "initial stock",
                          created_by: actor,
                        },
                      ],
                    }
                  : undefined,
            },
          }
        : undefined,
    }
  }

  private toImageCreate(
    image: ImageInput,
    rank: number,
  ): Prisma.ProductImageCreateWithoutProductInput {
    return { url: image.url, alt: image.alt, rank }
  }

  private async ensureProductExists(id: string): Promise<void> {
    const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundError(`Product "${id}" not found`)
  }

  /** Deletion cascades to variants → inventory items → reservations/movements,
   * so a product that appears in order history must be archived, never deleted. */
  private async ensureNoOrderHistory(productId: string): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { product_id: productId },
      select: { id: true },
    })
    if (variants.length === 0) return
    const referenced = await this.prisma.orderItem.findFirst({
      where: { variant_id: { in: variants.map((variant) => variant.id) } },
      select: { id: true },
    })
    if (referenced) {
      throw new HistoryExistsError(
        `Product "${productId}" is referenced by order history; archive it instead`,
        { product_id: productId },
      )
    }
  }

  private async ensureCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundError(`Category "${id}" not found`)
  }

  private async productHandleExists(handle: string): Promise<boolean> {
    const existing = await this.prisma.product.findUnique({
      where: { handle },
      select: { id: true },
    })
    return existing !== null
  }

  private async generateUniqueHandle(title: string): Promise<string> {
    const base = this.slugify(title) || "product"
    let candidate = base
    let suffix = 2
    while (await this.productHandleExists(candidate)) {
      candidate = `${base}-${suffix++}`
    }
    return candidate
  }

  private async generateUniqueSlug(base: string): Promise<string> {
    let candidate = base
    let suffix = 2
    for (;;) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      })
      if (!existing) return candidate
      candidate = `${base}-${suffix++}`
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160)
  }

  private mapWriteError(error: unknown, context?: { handle?: string }): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(",")
        : String(error.meta?.target ?? "")
      if (target.includes("handle")) return new DuplicateHandleError(context?.handle ?? target)
      if (target.includes("slug")) return new DuplicateSlugError(target)
    }
    return error
  }
}
