import { AppShell } from "@/components/app-shell"
import { SiteProvider } from "@/components/site-provider"
import { getEnv } from "@/lib/server/env"

// Lee variables de entorno en cada request (no se puede prerenderizar).
export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <AppShell mocks={getEnv().useMocks}>{children}</AppShell>
    </SiteProvider>
  )
}
