import { createReadStream } from "node:fs"
import type { Writable } from "node:stream"
import { Controller, Get, Param, Res } from "@nestjs/common"
import { MediaService } from "./media.service"

/** Minimal surface of the underlying Express response we rely on. */
interface StreamableResponse extends Writable {
  set(headers: Record<string, string>): void
}

/**
 * Serves durable media back to browsers (public product images, admin
 * previews). Files are streamed from the configured `MEDIA_DIR`; no storage
 * credentials or internal paths ever leave the server.
 */
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get("products/:file")
  async serve(@Param("file") file: string, @Res() res: StreamableResponse): Promise<void> {
    const { absolutePath, contentType, bytes } = await this.media.resolveForServe(`products/${file}`)
    res.set({
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(bytes),
    })
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(absolutePath)
      stream.on("error", reject)
      stream.on("end", resolve)
      stream.pipe(res)
    })
  }
}