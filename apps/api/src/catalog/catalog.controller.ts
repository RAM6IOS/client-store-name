import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FilesInterceptor } from "@nestjs/platform-express"
import { AdminApiKeyGuard } from "../common/guards/admin-api-key.guard"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT } from "../media/media.service"
import { CatalogService } from "./catalog.service"
import {
  createCategorySchema,
  createImageSchema,
  createProductSchema,
  createVariantSchema,
  generateVariantsSchema,
  listCategoriesQuerySchema,
  listProductsQuerySchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
  type CreateCategoryInput,
  type CreateProductInput,
  type GenerateVariantsInput,
  type ImageInput,
  type ListCategoriesQuery,
  type ListProductsQuery,
  type UpdateCategoryInput,
  type UpdateProductInput,
  type UpdateVariantInput,
  type VariantInput,
} from "./dto/catalog.schemas"

/** Shape multer's memory storage hands to `@UploadedFiles()`. */
interface UploadedMediaFile {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/** Minimal Express request surface needed to build absolute media URLs. */
interface MediaRequest {
  protocol: string
  get(name: string): string | undefined
}

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ───────────────────────────── Products ─────────────────────────────

  @Post("products")
  @UseGuards(AdminApiKeyGuard)
  createProduct(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.catalog.createProduct(body, actor)
  }

  @Get("products")
  listProducts(@Query(new ZodValidationPipe(listProductsQuerySchema)) query: ListProductsQuery) {
    return this.catalog.listProducts(query)
  }

  @Get("products/by-handle/:handle")
  getProductByHandle(@Param("handle") handle: string) {
    return this.catalog.getProductByHandle(handle)
  }

  @Get("products/:id")
  getProduct(@Param("id") id: string) {
    return this.catalog.getProduct(id)
  }

  @Patch("products/:id")
  @UseGuards(AdminApiKeyGuard)
  updateProduct(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.catalog.updateProduct(id, body)
  }

  @Delete("products/:id")
  @UseGuards(AdminApiKeyGuard)
  deleteProduct(@Param("id") id: string) {
    return this.catalog.deleteProduct(id)
  }

  // ───────────────────────────── Variants ─────────────────────────────

  @Post("products/:id/variants")
  @UseGuards(AdminApiKeyGuard)
  addVariant(
    @Param("id") productId: string,
    @Body(new ZodValidationPipe(createVariantSchema)) body: VariantInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.catalog.addVariant(productId, body, actor)
  }

  @Post("products/:id/generate-variants")
  @UseGuards(AdminApiKeyGuard)
  generateVariants(
    @Param("id") productId: string,
    @Body(new ZodValidationPipe(generateVariantsSchema)) body: GenerateVariantsInput,
    @Headers("x-actor") actor?: string,
  ) {
    return this.catalog.generateVariants(productId, body.options, actor)
  }

  @Patch("variants/:id")
  @UseGuards(AdminApiKeyGuard)
  updateVariant(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateVariantSchema)) body: UpdateVariantInput,
  ) {
    return this.catalog.updateVariant(id, body)
  }

  @Delete("variants/:id")
  @UseGuards(AdminApiKeyGuard)
  deleteVariant(@Param("id") id: string) {
    return this.catalog.deleteVariant(id)
  }

  // ───────────────────────────── Images ─────────────────────────────

  @Post("products/:id/images")
  @UseGuards(AdminApiKeyGuard)
  addImage(
    @Param("id") productId: string,
    @Body(new ZodValidationPipe(createImageSchema)) body: ImageInput,
  ) {
    return this.catalog.addImage(productId, body)
  }

  @Post("products/:id/images/upload")
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(
    FilesInterceptor("files", MAX_IMAGES_PER_PRODUCT, {
      limits: { files: MAX_IMAGES_PER_PRODUCT, fileSize: MAX_IMAGE_BYTES },
    }),
  )
  uploadImages(
    @Param("id") productId: string,
    @UploadedFiles() files: UploadedMediaFile[],
    @Req() request: MediaRequest,
  ) {
    const baseUrl = `${request.protocol}://${request.get("host") ?? "localhost"}`
    return this.catalog.uploadImages(productId, files ?? [], baseUrl)
  }

  @Delete("images/:id")
  @UseGuards(AdminApiKeyGuard)
  deleteImage(@Param("id") id: string) {
    return this.catalog.deleteImage(id)
  }

  // ──────────────────────────── Categories ────────────────────────────

  @Post("categories")
  @UseGuards(AdminApiKeyGuard)
  createCategory(@Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput) {
    return this.catalog.createCategory(body)
  }

  @Get("categories")
  listCategories(
    @Query(new ZodValidationPipe(listCategoriesQuerySchema)) query: ListCategoriesQuery,
  ) {
    return this.catalog.listCategories(query.includeInactive)
  }

  @Get("categories/:id")
  getCategory(@Param("id") id: string) {
    return this.catalog.getCategory(id)
  }

  @Patch("categories/:id")
  @UseGuards(AdminApiKeyGuard)
  updateCategory(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.catalog.updateCategory(id, body)
  }

  @Delete("categories/:id")
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  deleteCategory(@Param("id") id: string) {
    return this.catalog.deleteCategory(id)
  }
}
