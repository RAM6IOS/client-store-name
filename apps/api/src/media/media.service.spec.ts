import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ConfigService } from "@nestjs/config"
import { NotFoundError } from "../common/errors/domain-error"
import { InvalidImageError } from "../common/errors/domain-error"
import { MAX_IMAGE_BYTES, MediaService } from "./media.service"

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.from("VP8 "),
])
const AVIF = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x1c]),
  Buffer.from("ftyp"),
  Buffer.from("avif"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("avif"),
  Buffer.from("mif1"),
])

describe("MediaService", () => {
  let dir: string
  let media: MediaService

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "bita-media-"))
    media = new MediaService(new ConfigService({ MEDIA_DIR: dir }))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  describe("validateImage", () => {
    it("accepts real JPEG, PNG, WebP and AVIF content", () => {
      expect(media.validateImage(JPEG, "a.jpg")).toBe("jpg")
      expect(media.validateImage(PNG, "b.png")).toBe("png")
      expect(media.validateImage(WEBP, "c.webp")).toBe("webp")
      expect(media.validateImage(AVIF, "d.avif")).toBe("avif")
    })

    it("rejects non-image content even when the client lies about the type", () => {
      expect(() => media.validateImage(Buffer.from("just some text"), "evil.png")).toThrow(
        InvalidImageError,
      )
    })

    it("rejects an ftyp container that is not AVIF", () => {
      const mp4 = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]),
        Buffer.from("ftyp"),
        Buffer.from("isom"),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
      ])
      expect(() => media.validateImage(mp4, "clip.mp4")).toThrow(InvalidImageError)
    })

    it("rejects an empty file", () => {
      expect(() => media.validateImage(Buffer.alloc(0), "empty.png")).toThrow(InvalidImageError)
    })

    it("rejects a file larger than the limit", () => {
      const huge = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)])
      expect(() => media.validateImage(huge, "huge.png")).toThrow(InvalidImageError)
    })
  })

  describe("save / serve / remove", () => {
    it("writes a validated file durably and serves it back", async () => {
      const saved = await media.saveImage(PNG, "photo.png")
      expect(saved.key).toMatch(/^products\/[a-z0-9-]+\.png$/)

      const onDisk = await readFile(path.join(dir, saved.key))
      expect(onDisk.equals(PNG)).toBe(true)

      const resolved = await media.resolveForServe(saved.key)
      expect(resolved.contentType).toBe("image/png")
      expect(resolved.bytes).toBe(PNG.length)
    })

    it("builds a browser URL from a key", () => {
      expect(media.toPublicUrl("products/x.png", "http://localhost:3001/")).toBe(
        "http://localhost:3001/api/media/products/x.png",
      )
    })

    it("stores and serves AVIF with the correct content type", async () => {
      const saved = await media.saveImage(AVIF, "photo.avif")
      expect(saved.key).toMatch(/^products\/[a-z0-9-]+\.avif$/)
      const resolved = await media.resolveForServe(saved.key)
      expect(resolved.contentType).toBe("image/avif")
    })

    it("removes a file by its persisted URL", async () => {
      const saved = await media.saveImage(JPEG, "photo.jpg")
      const url = media.toPublicUrl(saved.key, "http://localhost:3001")
      await media.removeByUrl(url)
      await expect(media.resolveForServe(saved.key)).rejects.toBeInstanceOf(NotFoundError)
    })

    it("ignores externally hosted URLs", async () => {
      await expect(media.removeByUrl("https://cdn.example.com/pic.png")).resolves.toBeUndefined()
    })
  })

  describe("path safety", () => {
    it("refuses traversal outside the storage root", async () => {
      await expect(media.resolveForServe("products/../../etc/passwd")).rejects.toBeInstanceOf(
        NotFoundError,
      )
      await expect(media.resolveForServe("../secret.png")).rejects.toBeInstanceOf(NotFoundError)
    })

    it("reports a missing file as not found instead of throwing raw", async () => {
      await expect(media.resolveForServe("products/missing.png")).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })
  })
})