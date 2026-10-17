"use client"

import { useState } from "react"
import { ProductImage } from "./product-image"

export function ProductGallery({
  images,
  title,
}: {
  images: Array<{ url: string; alt: string | null }>
  title: string
}) {
  const [active, setActive] = useState(0)
  const current = images[active]

  return (
    <div className="stack">
      <div className="gallery-main">
        <ProductImage
          src={current?.url ?? null}
          alt={current?.alt ?? title}
          sizes="(max-width: 900px) 100vw, 50vw"
          priority
        />
      </div>
      {images.length > 1 ? (
        <div className="chips" role="group" aria-label={title}>
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              className="chip"
              aria-current={index === active ? "true" : undefined}
              onClick={() => setActive(index)}
              style={{ padding: "0.25rem" }}
            >
              <span
                style={{
                  display: "block",
                  position: "relative",
                  width: 48,
                  height: 48,
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <ProductImage src={image.url} alt={image.alt ?? title} sizes="48px" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
