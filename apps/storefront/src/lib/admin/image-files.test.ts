import { createImagePreviews, MAX_IMAGE_BYTES, revokeImagePreviews, validateImageFile, validateImageFiles } from "./image-files"

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
])

const AVIF = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c,
  0x66, 0x74, 0x79, 0x70, // ftyp
  0x61, 0x76, 0x69, 0x66, // avif
  0x00, 0x00, 0x00, 0x00,
  0x61, 0x76, 0x69, 0x66,
  0x6d, 0x69, 0x66, 0x31,
])

function toFile(name: string, bytes: Uint8Array, type: string) {
  return new File([bytes.buffer as ArrayBuffer], name, { type })
}

describe("image-files", () => {
  it("validates real image files by magic bytes", async () => {
    const png = await validateImageFile(toFile("pic.png", PNG, "image/png"))
    expect(png.mime).toBe("image/png")
    expect(png.ext).toBe("png")
    const jpg = await validateImageFile(toFile("pic.jpg", JPEG, "image/jpeg"))
    expect(jpg.mime).toBe("image/jpeg")
    expect(jpg.ext).toBe("jpg")
    const webp = await validateImageFile(toFile("pic.webp", WEBP, "image/webp"))
    expect(webp.mime).toBe("image/webp")
    expect(webp.ext).toBe("webp")
    const avif = await validateImageFile(toFile("pic.avif", AVIF, "image/avif"))
    expect(avif.mime).toBe("image/avif")
    expect(avif.ext).toBe("avif")
  })

  it("rejects files that are not real images", async () => {
    await expect(validateImageFile(toFile("txt.txt", new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]), "text/plain"))).rejects.toThrow("INVALID_IMAGE")
  })

  it("rejects an ftyp container that is not AVIF", async () => {
    const mp4 = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
    ])
    await expect(validateImageFile(toFile("clip.mp4", mp4, "video/mp4"))).rejects.toThrow("INVALID_IMAGE")
  })

  it("rejects files larger than the limit", async () => {
    const big = new Uint8Array(PNG.length + MAX_IMAGE_BYTES)
    big.set(PNG, 0)
    await expect(validateImageFile(toFile("big.png", big, "image/png"))).rejects.toThrow("FILE_TOO_LARGE")
  })

  it("creates and revokes preview URLs", () => {
    const file = toFile("pic.png", PNG, "image/png")
    const previews = createImagePreviews([file])
    expect(previews[0].previewUrl).toMatch(/^blob:/)
    revokeImagePreviews(previews)
  })

  it("rejects batches that exceed the product cap", async () => {
    const files = Array.from({ length: 21 }, () => toFile("p.png", PNG, "image/png"))
    await expect(validateImageFiles(files)).rejects.toThrow("IMAGE_COUNT_EXCEEDED")
  })
})