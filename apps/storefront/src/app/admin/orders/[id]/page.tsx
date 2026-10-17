import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Alert, Badge, Price } from "@/components/ui"
import { ConfirmSubmit } from "@/components/admin/confirm-submit"
import { RecordCollectionButton } from "@/components/admin/record-collection-button"
import { SubmitButton } from "@/components/admin/submit-button"
import { ApiError } from "@/lib/api"
import type { OrderStatus } from "@/lib/api-types"
import { getAdminOrder } from "@/lib/admin/client"
import {
  COLLECTION_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
} from "@/lib/admin/labels"
import { formatDateTime, toneForStatus } from "@/lib/admin/format"
import { getAdminKey } from "@/lib/admin/session"
import { translate } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n/dictionaries"
import { getLocale } from "@/lib/i18n/server"
import { orderAction, orderStatusAction } from "../../actions"

/** Which operational actions the state machine allows from a given status. */
const ACTIONS_BY_STATUS: Record<OrderStatus, TranslationKey[]> = {
  pending_confirmation: [
    "admin.action.confirm",
    "admin.action.noAnswer",
    "admin.action.wrongNumber",
    "admin.action.cancel",
  ],
  confirmed: [
    "admin.action.prepare",
    "admin.action.noAnswer",
    "admin.action.wrongNumber",
    "admin.action.cancel",
  ],
  preparing: ["admin.action.dispatch", "admin.action.cancel"],
  dispatched: ["admin.action.transit", "admin.action.cancel"],
  shipped: ["admin.action.deliver", "admin.action.deliveryFailed", "admin.action.return"],
  delivered: ["admin.action.return"],
  delivery_failed: [
    "admin.action.prepare",
    "admin.action.dispatch",
    "admin.action.transit",
    "admin.action.cancel",
  ],
  returned: [],
  cancelled: [],
  no_answer: ["admin.action.confirm", "admin.action.wrongNumber", "admin.action.cancel"],
  wrong_number: ["admin.action.confirm", "admin.action.noAnswer", "admin.action.cancel"],
}

const ACTION_VALUES: Record<string, string> = {
  "admin.action.confirm": "confirm",
  "admin.action.prepare": "prepare",
  "admin.action.dispatch": "dispatch",
  "admin.action.transit": "transit",
  "admin.action.deliver": "deliver",
  "admin.action.deliveryFailed": "delivery-failed",
  "admin.action.return": "return",
  "admin.action.cancel": "cancel",
  "admin.action.noAnswer": "no-answer",
  "admin.action.wrongNumber": "wrong-number",
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const key = await getAdminKey()
  if (!key) redirect("/admin/login")

  const { id } = await params
  const query = await searchParams
  const locale = await getLocale()
  const t = (k: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, k, vars)

  let order
  try {
    order = await getAdminOrder(key, id)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/admin/login")
    }
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const rawBack = typeof query.back === "string" ? query.back : ""
  const back = rawBack.startsWith("?") ? rawBack : ""
  const backHref = `/admin/orders${back}`
  const errorParam = typeof query.error === "string" ? query.error : undefined
  const errorMessage =
    errorParam === "unauthorized"
      ? t("admin.action.unauthorized")
      : errorParam === "invalidTransition"
        ? t("admin.action.invalidTransition")
        : errorParam
          ? t("admin.action.error")
          : null

  const allowedActions = ACTIONS_BY_STATUS[order.status]
  const nonCancelActions = allowedActions.filter((action) => action !== "admin.action.cancel")
  const canCancel = allowedActions.includes("admin.action.cancel")

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title">{t("admin.detail.title", { ref: order.display_id })}</h1>
        <div className="row">
          <Link href={backHref} className="btn btn-outline btn-sm">
            {t("admin.detail.back")}
          </Link>
          <a
            href={`/admin/orders/${order.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            {t("admin.detail.print")}
          </a>
        </div>
      </div>

      <section className="card card-pad stack" style={{ border: '2px solid var(--primary, #2563eb)', background: 'var(--card-bg, #fff)' }}>
        <div className="row wrap spread" style={{ alignItems: 'center', gap: '1rem' }}>
          <div className="row wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-sm muted">{t("admin.common.status")}:</span>
            <div style={{ fontSize: '1.25rem', display: 'inline-block' }}>
              <Badge tone={toneForStatus(order.status)}>{t(ORDER_STATUS_LABEL[order.status])}</Badge>
            </div>
          </div>

          <div className="row wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
            <form action={orderStatusAction} className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <input type="hidden" name="id" value={order.id} />
              {back ? <input type="hidden" name="back" value={back} /> : null}
              <input type="hidden" name="actor" value="admin" />
              <select
                name="to_status"
                className="input"
                defaultValue={order.status}
                aria-label={t("admin.orders.changeStatus")}
                style={{ width: 'auto', minWidth: '170px' }}
              >
                <option value="pending_confirmation">{t("order.status.pending_confirmation")}</option>
                <option value="confirmed">{t("order.status.confirmed")}</option>
                <option value="preparing">{t("order.status.preparing")}</option>
                <option value="dispatched">{t("order.status.dispatched")}</option>
                <option value="shipped">{t("order.status.shipped")}</option>
                <option value="delivered">{t("order.status.delivered")}</option>
                <option value="returned">{t("order.status.returned")}</option>
                <option value="delivery_failed">{t("order.status.delivery_failed")}</option>
                <option value="cancelled">{t("order.status.cancelled")}</option>
                <option value="no_answer">{t("order.status.no_answer")}</option>
                <option value="wrong_number">{t("order.status.wrong_number")}</option>
              </select>
              <button type="submit" className="btn btn-outline btn-sm">
                {t("admin.orders.apply")}
              </button>
            </form>
          </div>

          <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
            {order.status === "pending_confirmation" && (
              <form action={orderAction}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="action" value="confirm" />
                <input type="hidden" name="actor" value="admin" />
                {back ? <input type="hidden" name="back" value={back} /> : null}
                <button
                  type="submit"
                  className="btn btn-success btn-lg"
                  style={{ background: "#10b981", color: "#fff", fontWeight: "bold", padding: "0.5rem 1.25rem", fontSize: "1rem" }}
                >
                  {t("admin.action.confirm")}
                </button>
              </form>
            )}

            {order.status === "dispatched" && (
              <form action={orderAction}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="action" value="transit" />
                <input type="hidden" name="actor" value="admin" />
                {back ? <input type="hidden" name="back" value={back} /> : null}
                <button type="submit" className="btn btn-primary btn-sm">
                  إضافة رقم التتبع
                </button>
              </form>
            )}

            {order.status === "delivered" && (
              <RecordCollectionButton />
            )}

            {canCancel && order.status !== "cancelled" && order.status !== "returned" && (
              <form action={orderAction}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="action" value="cancel" />
                <input type="hidden" name="actor" value="admin" />
                <input type="hidden" name="reason" value="operator_cancelled" />
                {back ? <input type="hidden" name="back" value={back} /> : null}
                <ConfirmSubmit
                  message={t("admin.action.cancelConfirm")}
                  className="btn btn-danger btn-sm"
                  style={{ background: "#ef4444", color: "#fff", fontWeight: "600" }}
                >
                  {t("admin.action.cancel")}
                </ConfirmSubmit>
              </form>
            )}
          </div>
        </div>
      </section>

      {errorMessage ? (
        <Alert tone="error" role="alert">
          {errorMessage}
        </Alert>
      ) : null}

      <section className="card card-pad stack">
        <h2 className="card-title">{t("admin.detail.statuses")}</h2>
        <div className="row wrap">
          <Badge tone={toneForStatus(order.status)}>{t(ORDER_STATUS_LABEL[order.status])}</Badge>
          <Badge tone={toneForStatus(order.shipment_status)}>
            {t(SHIPMENT_STATUS_LABEL[order.shipment_status])}
          </Badge>
          <Badge tone={toneForStatus(order.collection_status)}>
            {t(COLLECTION_STATUS_LABEL[order.collection_status])}
          </Badge>
        </div>
        <p className="hint">{t("admin.detail.collectionNote")}</p>
      </section>

      <div className="detail-grid">
        <section className="card card-pad stack">
          <h2 className="card-title">{t("admin.detail.customer")}</h2>
          <dl className="facts">
            <dt>{t("admin.detail.customer")}</dt>
            <dd>{order.customer_name}</dd>
            <dt>{t("admin.detail.phone")}</dt>
            <dd dir="ltr">{order.customer_phone}</dd>
            {order.email ? (
              <>
                <dt>E-mail</dt>
                <dd dir="ltr">{order.email}</dd>
              </>
            ) : null}
            <dt>{t("admin.detail.placedAt")}</dt>
            <dd>{formatDateTime(order.placed_at, locale)}</dd>
          </dl>
        </section>

        <section className="card card-pad stack">
          <h2 className="card-title">{t("admin.detail.delivery")}</h2>
          <dl className="facts">
            <dt>{t("admin.detail.method")}</dt>
            <dd>{order.delivery_label ?? order.delivery_method}</dd>
            <dt>{t("admin.orders.destination")}</dt>
            <dd>
              {order.wilaya_name} — {order.commune}
              {order.commune_code ? ` (${order.commune_code})` : ""}
            </dd>
            {order.address_line ? (
              <>
                <dt>{t("admin.detail.address")}</dt>
                <dd>{order.address_line}</dd>
              </>
            ) : null}
            {order.nearby_landmark ? (
              <>
                <dt>{t("admin.detail.landmark")}</dt>
                <dd>{order.nearby_landmark}</dd>
              </>
            ) : null}
            {order.stop_desk ? (
              <>
                <dt>{t("admin.detail.stopDesk")}</dt>
                <dd>
                  {order.stop_desk.name ?? "—"}
                  {order.stop_desk.provider ? ` · ${order.stop_desk.provider}` : ""}
                </dd>
              </>
            ) : null}
            {order.notes ? (
              <>
                <dt>{t("admin.detail.notes")}</dt>
                <dd>{order.notes}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="card card-pad stack">
        <h2 className="card-title">{t("admin.detail.items")}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.detail.items")}</th>
                <th>SKU</th>
                <th>{t("admin.detail.quantity")}</th>
                <th>{t("admin.detail.unit")}</th>
                <th>{t("admin.detail.line")}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr key={line.id}>
                  <td>
                    <div>{line.product_title}</div>
                    {line.variant_title ? (
                      <div className="muted text-sm">{line.variant_title}</div>
                    ) : null}
                  </td>
                  <td dir="ltr">{line.sku ?? "—"}</td>
                  <td>{line.quantity}</td>
                  <td className="nowrap">
                    <Price
                      amount={line.unit_amount}
                      currency={line.currency_code}
                      locale={locale}
                    />
                  </td>
                  <td className="nowrap">
                    <Price
                      amount={line.line_amount}
                      currency={line.currency_code}
                      locale={locale}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="totals">
          <dt>{t("admin.detail.subtotal")}</dt>
          <dd>
            <Price amount={order.subtotal_amount} currency={order.currency_code} locale={locale} />
          </dd>
          <dt>{t("admin.detail.shipping")}</dt>
          <dd>
            <Price amount={order.shipping_amount} currency={order.currency_code} locale={locale} />
          </dd>
          <dt>{t("admin.detail.discount")}</dt>
          <dd>
            <Price amount={order.discount_amount} currency={order.currency_code} locale={locale} />
          </dd>
          <dt className="totals-total">{t("admin.detail.total")}</dt>
          <dd className="totals-total">
            <Price amount={order.total_amount} currency={order.currency_code} locale={locale} />
          </dd>
        </dl>
      </section>

      <section className="card card-pad stack">
        <h2 className="card-title">{t("admin.detail.actions")}</h2>
        {allowedActions.length === 0 ? (
          <p className="muted">{t("admin.detail.noActions")}</p>
        ) : (
          <div className="stack">
            {nonCancelActions.length > 0 ? (
              <form action={orderAction} className="stack-sm">
                <input type="hidden" name="id" value={order.id} />
                {back ? <input type="hidden" name="back" value={back} /> : null}
                <div className="field">
                  <label className="label" htmlFor="actor">
                    {t("admin.action.actor")}
                  </label>
                  <input
                    id="actor"
                    name="actor"
                    className="input"
                    required
                    maxLength={120}
                    defaultValue=""
                    placeholder={t("admin.action.actorPlaceholder")}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="note">
                    {t("admin.action.note")}
                  </label>
                  <input id="note" name="note" className="input" maxLength={500} />
                </div>
                <div className="row wrap">
                  {nonCancelActions.map((label) => (
                    <SubmitButton
                      key={label}
                      name="action"
                      value={ACTION_VALUES[label]}
                      className="btn btn-primary btn-sm"
                    >
                      {t(label)}
                    </SubmitButton>
                  ))}
                </div>
              </form>
            ) : null}

            {canCancel ? (
              <form action={orderAction} className="stack-sm cancel-form">
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="action" value="cancel" />
                {back ? <input type="hidden" name="back" value={back} /> : null}
                <div className="field">
                  <label className="label" htmlFor="cancel-actor">
                    {t("admin.action.actor")}
                  </label>
                  <input
                    id="cancel-actor"
                    name="actor"
                    className="input"
                    required
                    maxLength={120}
                    placeholder={t("admin.action.actorPlaceholder")}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="cancel-reason">
                    {t("admin.action.reason")}
                  </label>
                  <input
                    id="cancel-reason"
                    name="reason"
                    className="input"
                    required
                    maxLength={500}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="cancel-note">
                    {t("admin.action.note")}
                  </label>
                  <input id="cancel-note" name="note" className="input" maxLength={500} />
                </div>
                <ConfirmSubmit
                  message={t("admin.action.cancelConfirm")}
                  className="btn btn-danger btn-sm"
                >
                  {t("admin.action.cancel")}
                </ConfirmSubmit>
              </form>
            ) : null}
          </div>
        )}
      </section>

      <div className="detail-grid">
        <section className="card card-pad stack">
          <h2 className="card-title">{t("admin.detail.history")}</h2>
          {order.status_history.length === 0 ? (
            <p className="muted">{t("admin.detail.noHistory")}</p>
          ) : (
            <ol className="timeline">
              {order.status_history.map((entry) => (
                <li key={entry.id}>
                  <div className="row wrap">
                    <Badge tone={toneForStatus(entry.to_status)}>
                      {t(ORDER_STATUS_LABEL[entry.to_status])}
                    </Badge>
                    <span className="muted text-sm">
                      {formatDateTime(entry.created_at, locale)}
                    </span>
                  </div>
                  {entry.note ? <p className="text-sm">{entry.note}</p> : null}
                  {entry.changed_by ? (
                    <p className="muted text-sm">
                      {t("admin.action.actor")}: {entry.changed_by}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card card-pad stack">
          <h2 className="card-title">{t("admin.detail.reservations")}</h2>
          {order.reservations.length === 0 ? (
            <>
              <p className="muted">{t("admin.detail.noReservations")}</p>
              <p className="hint">{t("admin.detail.stockNote")}</p>
            </>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>{t("admin.detail.quantity")}</th>
                    <th>{t("admin.detail.reservationStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td dir="ltr" className="text-sm">
                        {reservation.variant_id.slice(0, 8)}…
                      </td>
                      <td>{reservation.quantity}</td>
                      <td>
                        <Badge tone={toneForStatus(reservation.status)}>
                          {t(RESERVATION_STATUS_LABEL[reservation.status])}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
