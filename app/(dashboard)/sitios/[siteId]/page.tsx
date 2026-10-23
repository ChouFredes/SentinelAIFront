import { SiteDetail } from "./site-detail"

export default async function SitePage({ params }: PageProps<"/sitios/[siteId]">) {
  const { siteId } = await params
  return <SiteDetail siteId={Number(siteId)} />
}
