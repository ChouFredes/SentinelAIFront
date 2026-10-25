import { AppShell } from "@/components/app-shell"
import { RuntimeProvider } from "@/components/runtime-provider"
import { SiteProvider } from "@/components/site-provider"
import { flowsPending } from "@/lib/server/backend-support"
import { getEnv } from "@/lib/server/env"

// Lee variables de entorno en cada request (no se puede prerenderizar).
export const dynamic = "force-dynamic"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { useMocks } = getEnv()
  return (
    <RuntimeProvider value={{ mocks: useMocks, flowsPending: flowsPending(useMocks) }}>
      <SiteProvider>
        <AppShell mocks={useMocks}>{children}</AppShell>
      </SiteProvider>
    </RuntimeProvider>
  )
}
