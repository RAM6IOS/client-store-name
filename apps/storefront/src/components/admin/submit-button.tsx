"use client"

import { useFormStatus } from "react-dom"
import type { ReactNode } from "react"

/**
 * A submit button wired to the pending state of its containing `<form>`. It
 * disables itself while the action runs, guards against duplicate submission,
 * and swaps the label to `pendingLabel` (or the pending message) while active.
 */
export function SubmitButton({
  pendingLabel,
  className,
  children,
  disabled,
  title,
  name,
  value,
}: {
  pendingLabel?: ReactNode
  className?: string
  children: ReactNode
  disabled?: boolean
  title?: string
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      title={title}
      name={name}
      value={value}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}