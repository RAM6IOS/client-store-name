// Simple image type sniffing without relying on external deps; works for unit tests
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const
export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES_PER_PRODUCT = 20

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif"

export interface ImagePreviewFile {
  file: File
  previewUrl: string
}

export interface ValidatedImageFile {
  file: File
  mime: AllowedMime
  ext: "jpg" | "png" | "webp" | "avif"
}

/** Reads the file into an ArrayBuffer to sniff its actual MIME type. */
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

/** Sniffs magic bytes to be sure the file is a real JPEG/PNG/WebP/AVIF. */
export async function sniffImageMime(buffer: ArrayBuffer): Promise<AllowedMime | undefined> {
  const view = new Uint8Array(buffer)
  const len = view.length
  if (len >= 8) {
    const s = view.subarray(0, 8)
    if (s[0] === 0x89 && s[1] === 0x50 && s[2] === 0x4e && s[3] === 0x47 && s[4] === 0x0d && s[5] === 0x0a && s[6] === 0x1a && s[7] === 0x0a)
      return "image/png"
  }
  if (len >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg"
  if (len >= 12) {
    const r = view.subarray(0, 4)
    const w = view.subarray(8, 12)
    if (r[0] === 0x52 && r[1] === 0x49 && r[2] === 0x46 && r[3] === 0x46 && w[0] === 0x57 && w[1] === 0x45 && w[2] === 0x42 && w[3] === 0x50)
      return "image/webp"
  }
  if (isAvif(view)) return "image/avif"
  return undefined
}

/** AVIF (ISO-BMFF/HEIF) check: `ftyp` marker plus an `avif`/`avis` brand. */
function isAvif(view: Uint8Array): boolean {
  const len = view.length
  if (len < 12) return false
  const type = String.fromCharCode(view[4], view[5], view[6], view[7])
  if (type !== "ftyp") return false
  const isBrand = (offset: number) => {
    const brand = String.fromCharCode(view[offset], view[offset + 1], view[offset + 2], view[offset + 3])
    return brand === "avif" || brand === "avis"
  }
  if (isBrand(8)) return true
  const scanEnd = Math.min(len, 64)
  for (let offset = 16; offset + 4 <= scanEnd; offset += 4) {
    if (isBrand(offset)) return true
  }
  return false
}

/** Validates a client-side File against type, size and magic bytes. */
export async function validateImageFile(file: File): Promise<ValidatedImageFile> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("FILE_TOO_LARGE")
  }
  const buffer = await readFileAsArrayBuffer(file)
  const mime = await sniffImageMime(buffer)
  if (!mime) throw new Error("INVALID_IMAGE")
  const ext =
    mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "avif"
  return { file, mime, ext }
}

/** Validates a batch and caps to MAX_IMAGES_PER_PRODUCT. */
export async function validateImageFiles(files: File[]): Promise<ValidatedImageFile[]> {
  if (files.length > MAX_IMAGES_PER_PRODUCT) throw new Error("IMAGE_COUNT_EXCEEDED")
  const results: ValidatedImageFile[] = []
  for (const f of files) {
    results.push(await validateImageFile(f))
  }
  return results
}

/** Creates object URLs for local previews. Call `revokeImagePreviews` later to
 * free memory. */
export function createImagePreviews(files: File[]): ImagePreviewFile[] {
  return files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
}

/** Revokes any preview URLs produced by `createImagePreviews`. */
export function revokeImagePreviews(previews: ImagePreviewFile[]): void {
  for (const p of previews) URL.revokeObjectURL(p.previewUrl)
}