"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Shield,
  Gauge,
  ShieldAlert,
  Building2,
  MonitorSmartphone,
  Radio,
  ScrollText,
  Settings,
  PanelLeft,
  LogOut,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { SiteSelect } from "@/components/site-select"
import { useHealth } from "@/lib/api/queries"
import { logout } from "@/app/(auth)/login/actions"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Resumen", icon: Gauge },
  { href: "/alertas", label: "Alertas", icon: ShieldAlert },
  { href: "/sitios", label: "Sitios", icon: Building2 },
  { href: "/dispositivos", label: "Dispositivos", icon: MonitorSmartphone },
  { href: "/datos-transmitidos", label: "Datos transmitidos", icon: Radio },
  { href: "/auditoria", label: "Auditoría", icon: ScrollText },
  { href: "/configuracion", label: "Configuración", icon: Settings },
]

const PAGE_TITLES: { match: (path: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Resumen" },
  ...NAV_ITEMS.filter((n) => n.href !== "/").map((n) => ({
    match: (p: string) => p === n.href || p.startsWith(`${n.href}/`),
    title: n.label,
  })),
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({
  children,
  mocks = false,
}: {
  children: React.ReactNode
  mocks?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  // El cajón móvil se cierra solo al cambiar de ruta: guardamos en qué ruta se abrió.
  const [openedAt, setOpenedAt] = React.useState<string | null>(null)
  const mobileOpen = openedAt === pathname
  const setMobileOpen = (open: boolean) => setOpenedAt(open ? pathname : null)

  const title =
    PAGE_TITLES.find((p) => p.match(pathname))?.title ?? "SentinelAI"

  return (
    <TooltipProvider delay={200}>
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        pathname={pathname}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        mocks={mocks}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          mocks={mocks}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
    </TooltipProvider>
  )
}

function Sidebar({
  pathname,
  collapsed,
  mobileOpen,
  mocks,
  onToggleCollapse,
  onCloseMobile,
}: {
  pathname: string
  collapsed: boolean
  mobileOpen: boolean
  mocks: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
        "-translate-x-full md:relative md:translate-x-0",
        mobileOpen && "translate-x-0"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Shield className="size-4" />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">
            SentinelAI
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar menú"
          className="ml-auto md:hidden"
          onClick={onCloseMobile}
        >
          <X />
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-primary" : "text-current"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }
          return link
        })}
      </nav>

      {/* Footer: connection pill + collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <HealthPill collapsed={collapsed} mocks={mocks} />

        <Separator className="my-2" />

        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
          className={cn(
            "hidden text-muted-foreground md:flex",
            collapsed ? "mx-auto" : "w-full justify-start"
          )}
        >
          <PanelLeft data-icon={collapsed ? undefined : "inline-start"} />
          {!collapsed && "Contraer"}
        </Button>
      </div>
    </aside>
  )
}

function HealthPill({ collapsed, mocks }: { collapsed: boolean; mocks: boolean }) {
  const { data, isLoading, isError } = useHealth()
  const ready = data && data.ml_ready && data.database_ready_at_startup && data.logging_ready
  const state = isLoading
    ? { dot: "bg-muted-foreground", ping: false, label: "Verificando backend…" }
    : isError
      ? { dot: "bg-critical", ping: false, label: "Backend sin respuesta" }
      : ready
        ? { dot: "bg-success", ping: true, label: mocks ? "Backend simulado" : "Backend operativo" }
        : { dot: "bg-high", ping: false, label: "Backend degradado" }
  return (
    <div
      role="status"
      title={state.label}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-2",
        collapsed ? "justify-center" : "bg-sidebar-accent/40"
      )}
    >
      <span className="relative flex size-2 shrink-0">
        {state.ping && (
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-70", state.dot)} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", state.dot)} />
      </span>
      {!collapsed && <span className="truncate text-xs text-muted-foreground">{state.label}</span>}
    </div>
  )
}

function TopBar({
  title,
  mocks,
  onOpenMobile,
}: {
  title: string
  mocks: boolean
  onOpenMobile: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Abrir menú de navegación"
        className="md:hidden"
        onClick={onOpenMobile}
      >
        <PanelLeft />
      </Button>

      <h1 className="text-base font-semibold tracking-tight text-balance">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {mocks && (
          <Badge variant="outline" className="hidden border-medium/30 bg-medium/12 text-medium-foreground sm:inline-flex">
            Datos simulados
          </Badge>
        )}
        <SiteSelect />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Cuenta"
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            AD
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
