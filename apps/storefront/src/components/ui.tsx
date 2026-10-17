import Link from "next/link"
import type { ReactNode } from "react"
import { formatMoney } from "@/lib/money"
import type { Locale } from "@/lib/i18n/locales"

export function Price({
  amount,
  currency,
  locale,
  className,
}: {
  amount: string | number | bigint
  currency: string
  locale: Locale
  className?: string
}) {
  return <span className={className}>{formatMoney(amount, currency, locale)}</span>
}

export type BadgeTone = "default" | "info" | "success" | "warning" | "danger"

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  default: "badge",
  info: "badge badge-info",
  success: "badge badge-success",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={BADGE_TONE_CLASS[tone]}>{children}</span>
}

export function Alert({
  children,
  tone = "info",
  role,
}: {
  children: ReactNode
  tone?: "info" | "error"
  role?: "alert" | "status"
}) {
  return (
    <div className={tone === "error" ? "alert alert-error" : "alert alert-info"} role={role}>
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card card-pad text-center" style={{ padding: "2.5rem 1rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
      {action}
    </div>
  )
}

export function CtaLink({
  href,
  children,
  variant = "primary",
  block = false,
}: {
  href: string
  children: ReactNode
  variant?: "primary" | "outline"
  block?: boolean
}) {
  const className = `btn ${variant === "primary" ? "btn-primary" : "btn-outline"}${block ? " btn-block" : ""}`
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
