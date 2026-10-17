"use client"

import { useEffect, useRef, useState } from "react"
import type { OrderStatus } from "@/lib/api-types"
import { Badge, type BadgeTone } from "@/components/ui"
import { orderStatusAction } from "@/app/admin/actions"

export interface StatusMenuOption {
  value: OrderStatus
  label: string
  tone: BadgeTone
  /** When set, the option asks for confirmation before submitting. */
  confirmMessage?: string
}

/**
 * Inline status control for the orders list: the current status badge doubles as
 * a trigger for a menu listing the transitions the state machine allows. Options
 * are pre-translated on the server; submitting posts `orderStatusAction`.
 */
export function OrderStatusMenu({
  orderId,
  currentLabel,
  currentTone,
  options,
  back,
  menuLabel,
}: {
  orderId: string
  currentLabel: string
  currentTone: BadgeTone
  options: StatusMenuOption[]
  back?: string
  menuLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (options.length === 0) {
    return <Badge tone={currentTone}>{currentLabel}</Badge>
  }

  return (
    <div className="status-menu" ref={ref}>
      <button
        type="button"
        className="status-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={menuLabel}
        aria-label={menuLabel}
      >
        <Badge tone={currentTone}>{currentLabel}</Badge>
        <span className="status-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="status-menu-list" role="menu" aria-label={menuLabel}>
          {options.map((option) => (
            <form
              key={option.value}
              action={orderStatusAction}
              className="status-menu-form"
              onSubmit={(event) => {
                if (option.confirmMessage && !window.confirm(option.confirmMessage)) {
                  event.preventDefault()
                }
              }}
            >
              <input type="hidden" name="id" value={orderId} />
              <input type="hidden" name="to_status" value={option.value} />
              {back ? <input type="hidden" name="back" value={back} /> : null}
              <button type="submit" role="menuitem" className="status-menu-item">
                <Badge tone={option.tone}>{option.label}</Badge>
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  )
}
