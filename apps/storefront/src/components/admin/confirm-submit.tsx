"use client"

import { useFormStatus } from "react-dom"
import type { CSSProperties, ReactNode } from "react"

/**
 * A submit button that asks for confirmation first. Used for destructive order
 * actions (cancellation) and catalog deletes so an operator cannot fire them
 * with a stray click. Disables itself while the action is pending.
 */
export function ConfirmSubmit({
  message,
  className,
  style,
  children,
}: {
  message: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {children}
    </button>
  )
}