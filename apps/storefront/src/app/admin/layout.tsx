import { AdminShell } from "@/components/admin/admin-shell"
import { getLocale } from "@/lib/i18n/server"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return <AdminShell locale={locale}>{children}</AdminShell>
}
