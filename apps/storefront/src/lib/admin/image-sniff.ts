import { ALLOWED_MIME_TYPES, type AllowedMime } from "./image-files"

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const WEBP_RIFF = Buffer.from("RIFF")
const WEBP_HEAD = Buffer.from("WEBP")

/** Sniffs magic bytes to be sure the file is a real JPEG/PNG/WebP/AVIF. */
export async function sniffImageMime(buffer: ArrayBuffer): Promise<AllowedMime | undefined> {
  const view = new Uint8Array(buffer)
  const len = view.length
  // PNG
  if (len >= 8) {
    const sig = view.subarray(0, 8)
    if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47 && sig[4] === 0x0d && sig[5] === 0x0a && sig[6] === 0x1a && sig[7] === 0x0a) return "image/png"
  }
  // JPEG
  if (len >= 3) {
    if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg"
  }
  // WebP (RIFF....WEBP)
  if (len >= 12) {
    const riff = view.subarray(0, 4)
    const webp = view.subarray(8, 12)
    if (riff[0] === 0x52 && riff[1] === 0x49 && riff[2] === 0x46 && riff[3] === 0x46 && webp[0] === 0x57 && webp[1] === 0x45 && webp[2] === 0x42 && webp[3] === 0x50) return "image/webp"
  }
  // AVIF (ISO-BMFF/HEIF: `ftyp` marker + `avif`/`avis` brand)
  if (isAvif(view)) return "image/avif"
  return undefined
}

function isAvif(view: Uint8Array): boolean {
  const len = view.length
  if (len < 12) return false
  if (String.fromCharCode(view[4], view[5], view[6], view[7]) !== "ftyp") return false
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
