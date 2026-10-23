import { AlertDetail } from "./alert-detail"

export default async function AlertDetailPage({ params }: PageProps<"/alertas/[alertId]">) {
  const { alertId } = await params
  return <AlertDetail alertId={Number(alertId)} />
}
