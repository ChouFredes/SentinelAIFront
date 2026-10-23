import * as React from "react"

export function PageHeader({
  title,
  description,
  actions,
  badges,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  badges?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-balance">{title}</h2>
          {badges}
        </div>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
