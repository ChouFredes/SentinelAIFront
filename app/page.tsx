import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MetricCard } from "@/components/metric-card"
import { RecentAlertsList } from "@/components/recent-alerts-list"
import { TopOrigins } from "@/components/top-origins"
import { AnomalyAreaChart } from "@/components/charts/anomaly-area-chart"
import { SeverityBarChart } from "@/components/charts/severity-bar-chart"
import { METRICS, THRESHOLD, MODEL_INFO } from "@/lib/mock-data"

export default function ResumenPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page intro */}
      <div className="flex flex-col gap-1">
        <p className="max-w-3xl text-sm text-muted-foreground text-pretty">
          Monitoreo en tiempo real del tráfico de red. Detección de anomalías
          mediante Autoencoder no supervisado ({MODEL_INFO.version}) con umbral
          de reconstrucción{" "}
          <span className="font-mono text-foreground">
            τ = {THRESHOLD.toFixed(4)}
          </span>
          .
        </p>
      </div>

      {/* Metrics */}
      <section
        aria-label="Indicadores principales"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {METRICS.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Anomalías por hora</CardTitle>
            <CardDescription>
              Flujos con score de reconstrucción por encima de τ — últimas 24 h
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnomalyAreaChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por severidad</CardTitle>
            <CardDescription>Alertas del período actual</CardDescription>
          </CardHeader>
          <CardContent>
            <SeverityBarChart />
          </CardContent>
        </Card>
      </section>

      {/* Alerts + origins */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentAlertsList />
        </div>
        <TopOrigins />
      </section>
    </div>
  )
}
