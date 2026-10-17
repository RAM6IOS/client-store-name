import { redirect } from "next/navigation"
import { Alert } from "@/components/ui"
import { getAdminKey } from "@/lib/admin/session"
import { translate } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n/dictionaries"
import { getLocale } from "@/lib/i18n/server"
import { loginAction } from "../actions"

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await getAdminKey()) redirect("/admin/orders")

  const { error } = await searchParams
  const locale = await getLocale()
  const t = (k: TranslationKey) => translate(locale, k)

  return (
    <div className="admin-login">
      <form action={loginAction} className="card card-pad stack">
        <h1 className="page-title">{t("admin.login.title")}</h1>
        <p className="muted text-sm">{t("admin.login.help")}</p>
        {error ? (
          <Alert tone="error" role="alert">
            {error === "unavailable" ? t("admin.login.unavailable") : t("admin.login.invalid")}
          </Alert>
        ) : null}
        <div className="field">
          <label className="label" htmlFor="key">
            {t("admin.login.key")}
          </label>
          <input
            id="key"
            name="key"
            type="password"
            className="input"
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          {t("admin.login.submit")}
        </button>
      </form>
    </div>
  )
}
