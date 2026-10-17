import { randomUUID } from "node:crypto"
import { mkdir, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InvalidImageError, NotFoundError } from "../common/errors/domain-error"

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

/** Default ceiling for a single image upload. Enforced again at the service
 * layer so direct callers cannot bypass the multipart limiter. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const MAX_IMAGES_PER_PRODUCT = 20

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const WEBP_RIFF = Buffer.from("RIFF")
const WEBP_HEAD = Buffer.from("WEBP")
const AVIF_FTYP = Buffer.from("ftyp")

export type ImageExt = "jpg" | "png" | "webp" | "avif"

export interface MediaSavedFile {
  key: string
  bytes: number
}

export interface ResolvedMedia {
  absolutePath: string
  contentType: string
  bytes: number
}

/**
 * Durable local-disk media store. Uploads are validated for *actual* content
 * (magic bytes, not just the client's `Content-Type`), written to a
 * configured `MEDIA_DIR` (never a temporary directory) and served back from
 * disk, so files survive restarts. Credentials and storage paths are never
 * exposed through responses.
 */
@Injectable()
export class MediaService {
  private readonly mediaRoot: string

  constructor(config: ConfigService) {
    this.mediaRoot = path.resolve(
      config.get<string>("MEDIA_DIR") ?? path.join(process.cwd(), ".bita-media"),
    )
  }

  /** Only used by tests/teardown to locate the storage root. */
  get root(): string {
    return this.mediaRoot
  }

  /** Rejects anything that is not a real JPEG/PNG/WebP. */
  validateImage(buffer: Buffer, sourceName: string): ImageExt {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new InvalidImageError(`"${sourceName}" is empty`, { file: sourceName, reason: "empty" })
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new InvalidImageError(`"${sourceName}" exceeds ${MAX_IMAGE_BYTES} bytes`, {
        file: sourceName,
        reason: "size",
        max: MAX_IMAGE_BYTES,
      })
    }
    const ext = this.sniffImageExt(buffer)
    if (!ext) {
      throw new InvalidImageError(
        `"${sourceName}" is not a supported image (JPEG, PNG, WebP or AVIF only)`,
        { file: sourceName, reason: "type" },
      )
    }
    return ext
  }

  /** Validates content and durably writes the file under `products/`. */
  async saveImage(buffer: Buffer, sourceName: string): Promise<MediaSavedFile> {
    const ext = this.validateImage(buffer, sourceName)
    const key = `products/${randomUUID()}.${ext}`
    const absolutePath = this.resolveKeyPath(key)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, buffer, { flag: "wx" })
    return { key, bytes: buffer.length }
  }

  /** Absolute, browser-reachable URL for a stored key. */
  toPublicUrl(key: string, baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, "")}/api/media/${key}`
  }

  /**
   * Resolves a stored key to an existing file for serving. Guards against
   * path traversal: storage keys are opaque server-generated values.
   */
  async resolveForServe(key: string): Promise<ResolvedMedia> {
    const absolutePath = this.resolveKeyPath(key)
    let info
    try {
      info = await stat(absolutePath)
    } catch {
      throw new NotFoundError(`Media "${key}" not found`)
    }
    if (!info.isFile()) throw new NotFoundError(`Media "${key}" not found`)
    return { absolutePath, contentType: this.contentTypeOf(absolutePath), bytes: info.size }
  }

  /** Removes the file behind a persisted URL (absolute or `/api/media/...`). */
  async removeByUrl(url: string): Promise<void> {
    const match = /\/api\/media\/(products\/[a-z0-9-]+\.[a-z]+)/i.exec(url)
    if (!match) return
    await this.removeByKey(match[1])
  }

  /** Best-effort physical cleanup. Missing files are not an error. */
  async removeByKey(key: string): Promise<void> {
    if (!this.isSafeStorageKey(key)) return
    try {
      await unlink(this.resolveKeyPath(key))
    } catch {
      // ENOENT and races are fine: the logical delete already succeeded.
    }
  }

  private sniffImageExt(buffer: Buffer): ImageExt | undefined {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return "png"
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) return "jpg"
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).equals(WEBP_RIFF) &&
      buffer.subarray(8, 12).equals(WEBP_HEAD)
    ) {
      return "webp"
    }
    if (this.isAvif(buffer)) return "avif"
    return undefined
  }

  /**
   * AVIF is an ISO-BMFF (HEIF) container: `ftyp` box at offset 4 with a major
   * brand of `avif`/`avis` (still/animation), or those brands listed among the
   * compatible brands. Sniffing the box avoids trusting the client MIME type.
   */
  private isAvif(buffer: Buffer): boolean {
    if (buffer.length < 12 || !buffer.subarray(4, 8).equals(AVIF_FTYP)) return false
    const hasBrand = (brand: string) => brand === "avif" || brand === "avis"
    if (hasBrand(buffer.subarray(8, 12).toString("latin1"))) return true
    // Compatible brands follow the 4-byte major brand + 4-byte minor version.
    const scanEnd = Math.min(buffer.length, 64)
    for (let offset = 16; offset + 4 <= scanEnd; offset += 4) {
      if (hasBrand(buffer.subarray(offset, offset + 4).toString("latin1"))) return true
    }
    return false
  }

  private resolveKeyPath(key: string): string {
    if (!this.isSafeStorageKey(key)) {
      throw new NotFoundError(`Media "${key}" not found`)
    }
    const absolutePath = path.resolve(this.mediaRoot, key)
    const relative = path.relative(this.mediaRoot, absolutePath)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new NotFoundError(`Media "${key}" not found`)
    }
    return absolutePath
  }

  private isSafeStorageKey(key: string): boolean {
    return (
      typeof key === "string" &&
      /^products\/[a-z0-9-]+\.[a-z]+$/i.test(key) &&
      !key.includes("..") &&
      !key.includes("\\")
    )
  }

  private contentTypeOf(absolutePath: string): string {
    const ext = path.extname(absolutePath).toLowerCase()
    if (ext === ".png") return "image/png"
    if (ext === ".webp") return "image/webp"
    if (ext === ".avif") return "image/avif"
    return "image/jpeg"
  }
}