"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { Badge } from "@/components/ui"
import { IMAGE_ACCEPT, MAX_IMAGES_PER_PRODUCT, validateImageFile } from "@/lib/admin/image-files"
import type { ProductImage } from "@/lib/api-types"
import { createTranslator } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/locales"

/** A file the operator selected but has not uploaded yet (kept client-side). */
interface PendingImage {
  key: string
  file: File
  previewUrl: string
}

type Primary = { kind: "existing"; id: string } | { kind: "pending"; key: string } | null

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * Product image manager shared by the create and edit product forms. It renders
 * a clickable upload area backed by a real `<input type="file">`, shows immediate
 * previews for both persisted and newly-selected images, lets the operator remove
 * any of them before saving, and marks one image as the primary (thumbnail).
 *
 * The component lives inside the parent product `<form>`, so it never nests a
 * form. It contributes through hidden inputs consumed by the server action:
 * the `files` control itself, `remove_image_ids`, `primary_file_index` and the
 * resolved `thumbnail` value.
 */
export function ProductImageManager({
  locale,
  existing = [],
  initialThumbnail,
}: {
  locale: Locale
  existing?: ProductImage[]
  initialThumbnail?: string | null
}) {
  const t = createTranslator(locale)
  const inputRef = useRef<HTMLInputElement>(null)
  const createdUrls = useRef<Set<string>>(new Set())

  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [pending, setPending] = useState<PendingImage[]>([])
  const [error, setError] = useState("")
  const [primary, setPrimary] = useState<Primary>(() => {
    const match = initialThumbnail
      ? existing.find((image) => image.url === initialThumbnail)
      : undefined
    return match ? { kind: "existing", id: match.id } : null
  })

  const visibleExisting = useMemo(
    () => existing.filter((image) => !removedIds.includes(image.id)),
    [existing, removedIds],
  )

  // Object URLs are browser resources; release every one we created on unmount.
  useEffect(() => {
    const urls = createdUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  function syncInputFiles(next: PendingImage[]): void {
    if (!inputRef.current || typeof DataTransfer === "undefined") return
    const transfer = new DataTransfer()
    for (const item of next) transfer.items.add(item.file)
    inputRef.current.files = transfer.files
  }

  // React resets the outer form once a form action settles, clearing the native
  // file input while our previews (React state) survive. Re-sync after every
  // commit so a retry still submits the operator's selection. This is a pure DOM
  // assignment (no state), so it cannot loop.
  useEffect(() => {
    syncInputFiles(pending)
  })

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return
    setError("")

    const room = Math.max(0, MAX_IMAGES_PER_PRODUCT - visibleExisting.length - pending.length)
    const accepted: PendingImage[] = []
    const seen = new Set(pending.map((item) => item.key))
    let invalid = false
    let tooLarge = false
    let overflow = false

    for (const file of Array.from(fileList)) {
      const key = fileKey(file)
      if (seen.has(key)) continue
      if (accepted.length >= room) {
        overflow = true
        continue
      }
      try {
        await validateImageFile(file)
      } catch (cause) {
        if (cause instanceof Error && cause.message === "FILE_TOO_LARGE") tooLarge = true
        else invalid = true
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      createdUrls.current.add(previewUrl)
      accepted.push({ key, file, previewUrl })
      seen.add(key)
    }

    if (accepted.length > 0) {
      const next = [...pending, ...accepted]
      setPending(next)
      syncInputFiles(next)
      setPrimary((current) => current ?? { kind: "pending", key: accepted[0].key })
    }

    if (overflow) setError(t("admin.products.image.errors.count"))
    else if (tooLarge) setError(t("admin.products.image.errors.tooLarge"))
    else if (invalid) setError(t("admin.products.image.errors.type"))

    // Allow re-selecting the same file after a failed validation.
    if (inputRef.current && accepted.length === 0) inputRef.current.value = ""
  }

  function removePending(key: string): void {
    const target = pending.find((item) => item.key === key)
    if (target) {
      URL.revokeObjectURL(target.previewUrl)
      createdUrls.current.delete(target.previewUrl)
    }
    const next = pending.filter((item) => item.key !== key)
    setPending(next)
    syncInputFiles(next)
    setPrimary((current) => (current?.kind === "pending" && current.key === key ? null : current))
  }

  function removeExisting(id: string): void {
    setRemovedIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setPrimary((current) => (current?.kind === "existing" && current.id === id ? null : current))
  }

  const pendingIndex =
    primary?.kind === "pending" ? pending.findIndex((item) => item.key === primary.key) : -1
  const thumbnailValue = (() => {
    if (primary?.kind === "existing")
      return existing.find((image) => image.id === primary.id)?.url ?? ""
    // A pending image becomes the thumbnail once the upload completes server-side.
    if (primary?.kind === "pending") return ""
    // No explicit choice: keep the inherited thumbnail unless it was just removed.
    const inheritedRemoved =
      !!initialThumbnail &&
      !!existing.find((image) => image.url === initialThumbnail && removedIds.includes(image.id))
    if (initialThumbnail && !inheritedRemoved) return initialThumbnail
    return visibleExisting[0]?.url ?? ""
  })()

  return (
    <section className="image-manager stack" aria-labelledby="product-images-heading">
      <h3 id="product-images-heading">{t("admin.products.images")}</h3>

      <label className="upload-dropzone" htmlFor="product-image-files">
        <svg
          className="upload-dropzone-icon"
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="upload-dropzone-title">{t("admin.products.image.chooseFiles")}</span>
        <span className="upload-dropzone-hint">{t("admin.products.image.chooseHint")}</span>
        <input
          ref={inputRef}
          id="product-image-files"
          name="files"
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>

      {error ? (
        <span className="field-error-text" role="alert">
          {error}
        </span>
      ) : null}

      {visibleExisting.length > 0 ? (
        <div className="stack-sm">
          <p className="muted text-sm">{t("admin.products.image.existing")}</p>
          <ul className="image-grid">
            {visibleExisting.map((image) => {
              const isPrimary = primary?.kind === "existing" && primary.id === image.id
              return (
                <li
                  key={image.id}
                  className={isPrimary ? "image-tile image-tile-primary" : "image-tile"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt ?? ""} loading="lazy" />
                  <div className="image-tile-actions">
                    {isPrimary ? (
                      <Badge tone="success">{t("admin.products.image.primary")}</Badge>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPrimary({ kind: "existing", id: image.id })}
                      >
                        {t("admin.products.image.setPrimary")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-danger"
                      onClick={() => removeExisting(image.id)}
                    >
                      {t("admin.products.image.remove")}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="stack-sm">
          <p className="muted text-sm">{t("admin.products.image.selected")}</p>
          <ul className="image-grid">
            {pending.map((item) => {
              const isPrimary = primary?.kind === "pending" && primary.key === item.key
              return (
                <li
                  key={item.key}
                  className={isPrimary ? "image-tile image-tile-primary" : "image-tile"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" />
                  <div className="image-tile-actions">
                    {isPrimary ? (
                      <Badge tone="success">{t("admin.products.image.primary")}</Badge>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPrimary({ kind: "pending", key: item.key })}
                      >
                        {t("admin.products.image.setPrimary")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-danger"
                      onClick={() => removePending(item.key)}
                    >
                      {t("admin.products.image.remove")}
                    </button>
                  </div>
                  <span className="badge">{t("admin.products.image.pending")}</span>
                </li>
              )
            })}
          </ul>
          <p className="hint">
            {t("admin.products.image.pendingCount", { count: pending.length })}
          </p>
        </div>
      ) : null}

      {removedIds.length > 0 ? (
        <p className="hint">{t("admin.products.image.removeOnSave")}</p>
      ) : null}

      <input type="hidden" name="thumbnail" value={thumbnailValue} />
      {removedIds.map((id) => (
        <input key={id} type="hidden" name="remove_image_ids" value={id} />
      ))}
      {pendingIndex >= 0 ? (
        <input type="hidden" name="primary_file_index" value={String(pendingIndex)} />
      ) : null}

      {pending.length > 0 ? <UploadingNote locale={locale} /> : null}
    </section>
  )
}

function UploadingNote({ locale }: { locale: Locale }) {
  const t = createTranslator(locale)
  const { pending } = useFormStatus()
  if (!pending) return null
  return (
    <p className="hint" role="status">
      {t("admin.products.image.uploading")}
    </p>
  )
}
