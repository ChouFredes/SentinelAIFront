import { Suspense } from "react"
import { AlertsView } from "./alerts-view"

export default function AlertasPage() {
  return (
    <Suspense>
      <AlertsView />
    </Suspense>
  )
}
