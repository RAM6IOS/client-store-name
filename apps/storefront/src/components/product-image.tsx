import Image from "next/image"

/**
 * Entity image with a graceful placeholder. Uses `next/image` with `fill`, so
 * the parent element must establish an aspect-ratio box with `position:
 * relative`. Remote hosts are allowed via `next.config.ts` `images.remotePatterns`.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null | undefined
  alt: string
  sizes: string
  priority?: boolean
}) {
  if (!src) {
    return (
      <span className="media-placeholder" aria-hidden="true">
        {alt.trim().slice(0, 1) || "—"}
      </span>
    )
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
}
