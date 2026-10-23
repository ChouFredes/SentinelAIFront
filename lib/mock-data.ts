// ---------------------------------------------------------------------------
// SentinelAI — mock data layer
// All UI copy is Spanish (Rioplatense); identifiers stay in English.
// This module is the single source of truth for the dashboard. No network I/O.
// ---------------------------------------------------------------------------

export const THRESHOLD = 0.0847 // τ — anomaly reconstruction-error threshold

export type Severity = "critica" | "alta" | "media" | "baja"
export type AlertStatus = "activa" | "mitigada" | "descartada" | "falso_positivo"
export type Protocol = "TCP" | "UDP"
export type AttackType =
  | "DDoS"
  | "PortScan"
  | "Bot"
  | "Web Attack"
  | "Infiltration"
  | "Brute Force"
export type MitigationActor = "Automático" | "Manual"
export type SensorStatus = "en_linea" | "degradado" | "sin_conexion"

export interface FeatureContribution {
  feature: string
  /** Share of the total reconstruction error attributable to this feature (0–1). */
  contribution: number
}

export interface MitigationAction {
  timestamp: string
  action: string
  rule: string
  actor: MitigationActor
}

export interface FlowRecord {
  srcIp: string
  dstIp: string
  srcPort: number
  dstPort: number
  protocol: Protocol
  /** Flow duration in milliseconds. */
  durationMs: number
  packetsSent: number
  packetsReceived: number
  bytesSent: number
  bytesReceived: number
  /** Mean inter-arrival time in milliseconds. */
  meanIatMs: number
}

export interface Alert {
  id: string
  timestamp: string
  severity: Severity
  srcIp: string
  dstIp: string
  port: number
  protocol: Protocol
  attackType: AttackType
  mseScore: number
  status: AlertStatus
  flow: FlowRecord
  featureContributions: FeatureContribution[]
  mitigationActions: MitigationAction[]
}

export interface Sensor {
  id: string
  name: string
  status: SensorStatus
  localIp: string
  hardware: string
  uptime: string
  lastHeartbeat: string
  flowsPerSecond: number
  cpuUsage: number
  memoryUsage: number
}

export interface SensorEvent {
  id: string
  timestamp: string
  sensorName: string
  eventType: string
  message: string
}

export interface MetricCard {
  id: string
  label: string
  value: string
  deltaPct: number
  /** Whether an increase is a positive signal (true) or a warning (false). */
  higherIsBetter: boolean
}

export interface AnomalyPoint {
  hour: string
  count: number
}

export interface OriginCount {
  ip: string
  count: number
  scope: "privada" | "pública"
}

// --- labels ---------------------------------------------------------------

export const SEVERITY_LABEL: Record<Severity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
}

export const STATUS_LABEL: Record<AlertStatus, string> = {
  activa: "Activa",
  mitigada: "Mitigada",
  descartada: "Descartada",
  falso_positivo: "Falso positivo",
}

export const SENSOR_STATUS_LABEL: Record<SensorStatus, string> = {
  en_linea: "En línea",
  degradado: "Degradado",
  sin_conexion: "Sin conexión",
}

// --- formatting helpers ----------------------------------------------------

/** "2026-08-13T03:47:12" -> "13/08 03:47:12" */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`
}

/** Full timestamp incl. year, for detail views. */
export function formatFullTimestamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function formatInt(n: number): string {
  return n.toLocaleString("es-AR")
}

/** Human byte formatting with Rioplatense decimal comma. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${units[unit]}`
}

// ---------------------------------------------------------------------------
// Base alert records — hand-tuned to look like a real SMB network capture.
// MSE scores cluster just above τ (0.0847); a handful sit far above.
// ---------------------------------------------------------------------------

const BASE_DAY = "2026-08-13"

interface AlertSeed {
  id: string
  time: string // HH:mm:ss
  severity: Severity
  srcIp: string
  dstIp: string
  port: number
  protocol: Protocol
  attackType: AttackType
  mseScore: number
  status: AlertStatus
}

const ALERT_SEEDS: AlertSeed[] = [
  {
    id: "ALR-2F9C41",
    time: "03:11:47",
    severity: "critica",
    srcIp: "45.148.10.77",
    dstIp: "10.0.4.18",
    port: 443,
    protocol: "TCP",
    attackType: "DDoS",
    mseScore: 0.1837,
    status: "mitigada",
  },
  {
    id: "ALR-2F9C3A",
    time: "03:04:12",
    severity: "critica",
    srcIp: "185.220.101.6",
    dstIp: "192.168.1.42",
    port: 3389,
    protocol: "TCP",
    attackType: "Brute Force",
    mseScore: 0.1543,
    status: "mitigada",
  },
  {
    id: "ALR-2F9C22",
    time: "02:58:36",
    severity: "alta",
    srcIp: "45.148.10.77",
    dstIp: "10.0.4.18",
    port: 80,
    protocol: "TCP",
    attackType: "DDoS",
    mseScore: 0.1291,
    status: "activa",
  },
  {
    id: "ALR-2F9C18",
    time: "02:51:09",
    severity: "critica",
    srcIp: "89.248.165.52",
    dstIp: "192.168.1.115",
    port: 22,
    protocol: "TCP",
    attackType: "Infiltration",
    mseScore: 0.2044,
    status: "activa",
  },
  {
    id: "ALR-2F9C05",
    time: "02:47:53",
    severity: "alta",
    srcIp: "192.168.1.115",
    dstIp: "10.0.4.9",
    port: 445,
    protocol: "TCP",
    attackType: "Bot",
    mseScore: 0.1122,
    status: "activa",
  },
  {
    id: "ALR-2F9BE9",
    time: "02:39:21",
    severity: "media",
    srcIp: "10.0.4.18",
    dstIp: "192.168.1.1",
    port: 53,
    protocol: "UDP",
    attackType: "PortScan",
    mseScore: 0.0964,
    status: "activa",
  },
  {
    id: "ALR-2F9BD1",
    time: "02:33:04",
    severity: "alta",
    srcIp: "185.220.101.6",
    dstIp: "192.168.1.42",
    port: 3389,
    protocol: "TCP",
    attackType: "Brute Force",
    mseScore: 0.1078,
    status: "mitigada",
  },
  {
    id: "ALR-2F9BB7",
    time: "01:52:38",
    severity: "media",
    srcIp: "192.168.1.42",
    dstIp: "10.0.4.18",
    port: 8080,
    protocol: "TCP",
    attackType: "Web Attack",
    mseScore: 0.0921,
    status: "activa",
  },
  {
    id: "ALR-2F9B90",
    time: "01:18:22",
    severity: "media",
    srcIp: "77.91.78.114",
    dstIp: "192.168.1.42",
    port: 80,
    protocol: "TCP",
    attackType: "Web Attack",
    mseScore: 0.0903,
    status: "descartada",
  },
  {
    id: "ALR-2F9B62",
    time: "00:44:57",
    severity: "baja",
    srcIp: "10.0.4.9",
    dstIp: "10.0.4.1",
    port: 123,
    protocol: "UDP",
    attackType: "PortScan",
    mseScore: 0.0861,
    status: "descartada",
  },
  {
    id: "ALR-2F9B3F",
    time: "23:57:11",
    severity: "media",
    srcIp: "193.106.191.20",
    dstIp: "192.168.1.115",
    port: 22,
    protocol: "TCP",
    attackType: "Brute Force",
    mseScore: 0.0958,
    status: "mitigada",
  },
  {
    id: "ALR-2F9B14",
    time: "22:31:48",
    severity: "alta",
    srcIp: "45.148.10.77",
    dstIp: "10.0.4.18",
    port: 443,
    protocol: "TCP",
    attackType: "DDoS",
    mseScore: 0.1364,
    status: "mitigada",
  },
  {
    id: "ALR-2F9AE0",
    time: "20:09:33",
    severity: "baja",
    srcIp: "192.168.1.88",
    dstIp: "10.0.4.18",
    port: 8080,
    protocol: "TCP",
    attackType: "Web Attack",
    mseScore: 0.0872,
    status: "falso_positivo",
  },
  {
    id: "ALR-2F9AB5",
    time: "18:22:04",
    severity: "media",
    srcIp: "141.98.11.9",
    dstIp: "192.168.1.42",
    port: 3389,
    protocol: "TCP",
    attackType: "Brute Force",
    mseScore: 0.0989,
    status: "activa",
  },
  {
    id: "ALR-2F9A81",
    time: "16:47:29",
    severity: "baja",
    srcIp: "10.0.4.9",
    dstIp: "192.168.1.1",
    port: 53,
    protocol: "UDP",
    attackType: "PortScan",
    mseScore: 0.0858,
    status: "falso_positivo",
  },
  {
    id: "ALR-2F9A52",
    time: "14:03:51",
    severity: "alta",
    srcIp: "62.204.41.170",
    dstIp: "192.168.1.115",
    port: 445,
    protocol: "TCP",
    attackType: "Bot",
    mseScore: 0.1187,
    status: "activa",
  },
  {
    id: "ALR-2F9A1C",
    time: "10:38:16",
    severity: "media",
    srcIp: "192.168.1.42",
    dstIp: "10.0.4.18",
    port: 80,
    protocol: "TCP",
    attackType: "Web Attack",
    mseScore: 0.0912,
    status: "descartada",
  },
  {
    id: "ALR-2F99E4",
    time: "06:12:40",
    severity: "baja",
    srcIp: "10.0.4.18",
    dstIp: "10.0.4.1",
    port: 123,
    protocol: "UDP",
    attackType: "PortScan",
    mseScore: 0.0853,
    status: "activa",
  },
]

// --- deterministic pseudo-random generator (stable across renders) --------

function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h
}

function makeRng(seed: number): () => number {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const FEATURE_POOL = [
  "Flow Duration",
  "Fwd Packet Length Std",
  "Flow IAT Mean",
  "Total Fwd Packets",
  "Bwd Packet Length Mean",
  "Flow Bytes/s",
  "Fwd IAT Total",
  "Init Win Bytes Fwd",
  "Subflow Fwd Bytes",
]

const ATTACK_FEATURE_BIAS: Record<AttackType, string[]> = {
  DDoS: ["Flow Bytes/s", "Total Fwd Packets", "Flow Duration"],
  PortScan: ["Total Fwd Packets", "Flow IAT Mean", "Fwd IAT Total"],
  Bot: ["Init Win Bytes Fwd", "Bwd Packet Length Mean", "Flow IAT Mean"],
  "Web Attack": ["Fwd Packet Length Std", "Subflow Fwd Bytes", "Flow Bytes/s"],
  Infiltration: ["Flow Duration", "Bwd Packet Length Mean", "Init Win Bytes Fwd"],
  "Brute Force": ["Total Fwd Packets", "Flow IAT Mean", "Fwd Packet Length Std"],
}

function buildFeatureContributions(seed: AlertSeed): FeatureContribution[] {
  const rng = makeRng(seedFromId(seed.id))
  const biased = ATTACK_FEATURE_BIAS[seed.attackType]
  const ordered = [
    ...biased,
    ...FEATURE_POOL.filter((f) => !biased.includes(f)),
  ].slice(0, 6)
  // Descending weights with a little jitter, normalized to sum to 1.
  const raw = ordered.map((_, i) => (6 - i) + rng() * 1.4)
  const total = raw.reduce((a, b) => a + b, 0)
  return ordered.map((feature, i) => ({
    feature,
    contribution: Number((raw[i] / total).toFixed(3)),
  }))
}

function buildFlow(seed: AlertSeed): FlowRecord {
  const rng = makeRng(seedFromId(seed.id) ^ 0x9e3779b9)
  const scale = seed.severity === "critica" ? 4 : seed.severity === "alta" ? 2.4 : 1
  const packetsSent = Math.round((80 + rng() * 900) * scale)
  const packetsReceived = Math.round(packetsSent * (0.3 + rng() * 0.6))
  const avgPkt = 60 + rng() * 700
  return {
    srcIp: seed.srcIp,
    dstIp: seed.dstIp,
    srcPort: 1024 + Math.round(rng() * 64000),
    dstPort: seed.port,
    protocol: seed.protocol,
    durationMs: Math.round((120 + rng() * 8000) * scale),
    packetsSent,
    packetsReceived,
    bytesSent: Math.round(packetsSent * avgPkt),
    bytesReceived: Math.round(packetsReceived * avgPkt * 0.7),
    meanIatMs: Number((0.2 + rng() * 12).toFixed(3)),
  }
}

function buildMitigation(seed: AlertSeed): MitigationAction[] {
  const base = new Date(`${BASE_DAY}T${seed.time}`)
  const at = (offsetSec: number) => {
    const d = new Date(base.getTime() + offsetSec * 1000)
    return d.toISOString()
  }
  const detection: MitigationAction = {
    timestamp: at(0),
    action: `Detección de anomalía — score ${seed.mseScore.toFixed(4)} supera τ`,
    rule: `Autoencoder — MSE ${seed.mseScore.toFixed(4)} > τ ${THRESHOLD.toFixed(4)}`,
    actor: "Automático",
  }

  if (seed.status === "descartada") {
    return [
      detection,
      {
        timestamp: at(42),
        action: "Alerta descartada por el analista",
        rule: "Sin acción de red aplicada",
        actor: "Manual",
      },
    ]
  }

  if (seed.status === "falso_positivo") {
    return [
      detection,
      {
        timestamp: at(31),
        action: "Limitación de ancho de banda al 20% — 60 s",
        rule: "tc qdisc add dev eth0 root tbf rate 20% (aplicada y revertida)",
        actor: "Automático",
      },
      {
        timestamp: at(174),
        action: "Marcada como falso positivo — mitigación revertida",
        rule: "iptables -D reglas asociadas al flujo",
        actor: "Manual",
      },
    ]
  }

  const full: MitigationAction[] = [
    detection,
    {
      timestamp: at(2),
      action: "Limitación de ancho de banda al 20% — 60 s",
      rule: "tc qdisc add dev eth0 root tbf rate 20% burst 32kb latency 400ms",
      actor: "Automático",
    },
    {
      timestamp: at(63),
      action: "Bloqueo de puertos no esenciales — 300 s",
      rule: `iptables -A FORWARD -s ${seed.srcIp} -p ${seed.protocol.toLowerCase()} -j DROP`,
      actor: "Automático",
    },
  ]

  if (seed.severity === "critica" || seed.status === "mitigada") {
    full.push({
      timestamp: at(366),
      action: "Bloqueo total de la IP origen — regla iptables aplicada",
      rule: `iptables -A INPUT -s ${seed.srcIp} -j DROP`,
      actor: seed.severity === "critica" ? "Automático" : "Manual",
    })
  }

  return full
}

export const ALERTS: Alert[] = ALERT_SEEDS.map((seed) => ({
  id: seed.id,
  timestamp: `${BASE_DAY}T${seed.time}`,
  severity: seed.severity,
  srcIp: seed.srcIp,
  dstIp: seed.dstIp,
  port: seed.port,
  protocol: seed.protocol,
  attackType: seed.attackType,
  mseScore: seed.mseScore,
  status: seed.status,
  flow: buildFlow(seed),
  featureContributions: buildFeatureContributions(seed),
  mitigationActions: buildMitigation(seed),
}))

export function getAlertById(id: string): Alert | undefined {
  return ALERTS.find((a) => a.id === id)
}

export const RECENT_ALERTS: Alert[] = [...ALERTS].slice(0, 5)

export const ACTIVE_ALERTS_COUNT = ALERTS.filter(
  (a) => a.status === "activa"
).length

// ---------------------------------------------------------------------------
// Summary metrics
// ---------------------------------------------------------------------------

export const METRICS: MetricCard[] = [
  {
    id: "flows",
    label: "Flujos analizados",
    value: formatInt(1284593),
    deltaPct: 4.2,
    higherIsBetter: true,
  },
  {
    id: "active",
    label: "Alertas activas",
    value: "7",
    deltaPct: 16.7,
    higherIsBetter: false,
  },
  {
    id: "anomalies",
    label: "Anomalías (24h)",
    value: "43",
    deltaPct: -8.5,
    higherIsBetter: false,
  },
  {
    id: "sensors",
    label: "Sensores activos",
    value: "3 de 3",
    deltaPct: 0,
    higherIsBetter: true,
  },
]

// Hourly anomaly counts across the last 24h — sums to 43, spike at 03:00.
export const ANOMALY_SERIES: AnomalyPoint[] = [
  { hour: "00:00", count: 1 },
  { hour: "01:00", count: 2 },
  { hour: "02:00", count: 6 },
  { hour: "03:00", count: 14 },
  { hour: "04:00", count: 6 },
  { hour: "05:00", count: 2 },
  { hour: "06:00", count: 1 },
  { hour: "07:00", count: 1 },
  { hour: "08:00", count: 1 },
  { hour: "09:00", count: 0 },
  { hour: "10:00", count: 1 },
  { hour: "11:00", count: 0 },
  { hour: "12:00", count: 1 },
  { hour: "13:00", count: 0 },
  { hour: "14:00", count: 1 },
  { hour: "15:00", count: 0 },
  { hour: "16:00", count: 1 },
  { hour: "17:00", count: 1 },
  { hour: "18:00", count: 0 },
  { hour: "19:00", count: 1 },
  { hour: "20:00", count: 1 },
  { hour: "21:00", count: 1 },
  { hour: "22:00", count: 0 },
  { hour: "23:00", count: 1 },
]

export const TOP_ORIGINS: OriginCount[] = [
  { ip: "45.148.10.77", count: 12, scope: "pública" },
  { ip: "192.168.1.42", count: 9, scope: "privada" },
  { ip: "185.220.101.6", count: 7, scope: "pública" },
  { ip: "10.0.4.18", count: 6, scope: "privada" },
  { ip: "192.168.1.115", count: 5, scope: "privada" },
]

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

export const SENSORS: Sensor[] = [
  {
    id: "sns-deposito",
    name: "Sensor-Deposito",
    status: "en_linea",
    localIp: "10.0.4.2",
    hardware: "Raspberry Pi 4 — ARM64",
    uptime: "18d 04h 22m",
    lastHeartbeat: `${BASE_DAY}T03:47:58`,
    flowsPerSecond: 342,
    cpuUsage: 38,
    memoryUsage: 61,
  },
  {
    id: "sns-oficina",
    name: "Sensor-Oficina",
    status: "en_linea",
    localIp: "192.168.1.2",
    hardware: "Raspberry Pi 4 — ARM64",
    uptime: "42d 11h 05m",
    lastHeartbeat: `${BASE_DAY}T03:48:01`,
    flowsPerSecond: 517,
    cpuUsage: 52,
    memoryUsage: 44,
  },
  {
    id: "sns-sucursal-sur",
    name: "Sensor-Sucursal-Sur",
    status: "degradado",
    localIp: "10.0.9.2",
    hardware: "Raspberry Pi 4 — ARM64",
    uptime: "6d 02h 47m",
    lastHeartbeat: `${BASE_DAY}T03:46:12`,
    flowsPerSecond: 128,
    cpuUsage: 79,
    memoryUsage: 83,
  },
]

export const SENSOR_EVENTS: SensorEvent[] = [
  {
    id: "evt-01",
    timestamp: `${BASE_DAY}T03:47:58`,
    sensorName: "Sensor-Deposito",
    eventType: "heartbeat",
    message: "Latido recibido — 342 flujos/s, cola de exportación vacía",
  },
  {
    id: "evt-02",
    timestamp: `${BASE_DAY}T03:46:12`,
    sensorName: "Sensor-Sucursal-Sur",
    eventType: "warning",
    message: "Uso de memoria al 83% — descartando muestreo de baja prioridad",
  },
  {
    id: "evt-03",
    timestamp: `${BASE_DAY}T03:11:49`,
    sensorName: "Sensor-Deposito",
    eventType: "mitigation",
    message: "Regla iptables aplicada sobre 45.148.10.77 (ALR-2F9C41)",
  },
  {
    id: "evt-04",
    timestamp: `${BASE_DAY}T03:04:15`,
    sensorName: "Sensor-Oficina",
    eventType: "mitigation",
    message: "Bloqueo de puerto 3389 sobre 185.220.101.6 (ALR-2F9C3A)",
  },
  {
    id: "evt-05",
    timestamp: `${BASE_DAY}T02:51:11`,
    sensorName: "Sensor-Oficina",
    eventType: "anomaly",
    message: "Flujo anómalo detectado hacia 192.168.1.115:22 — score 0.2044",
  },
  {
    id: "evt-06",
    timestamp: `${BASE_DAY}T02:38:40`,
    sensorName: "Sensor-Sucursal-Sur",
    eventType: "warning",
    message: "Latencia de exportación IPFIX elevada (412 ms)",
  },
  {
    id: "evt-07",
    timestamp: `${BASE_DAY}T01:20:03`,
    sensorName: "Sensor-Oficina",
    eventType: "info",
    message: "Modelo de detección actualizado a v2.4.1 sin reinicio",
  },
  {
    id: "evt-08",
    timestamp: `${BASE_DAY}T00:00:07`,
    sensorName: "Sensor-Deposito",
    eventType: "info",
    message: "Rotación diaria de logs completada (14,2 MB comprimidos)",
  },
  {
    id: "evt-09",
    timestamp: "2026-08-12T21:14:52",
    sensorName: "Sensor-Sucursal-Sur",
    eventType: "reconnect",
    message: "Reconexión con el motor SaaS tras 38 s sin enlace",
  },
  {
    id: "evt-10",
    timestamp: "2026-08-12T18:02:31",
    sensorName: "Sensor-Oficina",
    eventType: "heartbeat",
    message: "Latido recibido — 498 flujos/s, cola de exportación vacía",
  },
]

// ---------------------------------------------------------------------------
// Detection model metadata (read-only config surface)
// ---------------------------------------------------------------------------

export interface ModelInfo {
  version: string
  trainingDataset: string
  inputFeatures: number
  lastRetraining: string
  architecture: string
}

export const MODEL_INFO: ModelInfo = {
  version: "v2.4.1",
  trainingDataset: "CIC-IDS2017",
  inputFeatures: 18,
  lastRetraining: "2026-08-06",
  architecture: "Autoencoder 18-12-6-12-18 (no supervisado)",
}

export const MITIGATION_DEFAULTS = {
  automatic: true,
  bandwidthLimitSeconds: 60,
  portBlockSeconds: 300,
  fullBlockSeconds: 900,
  allowlist: "192.168.1.1\n10.0.4.1\n10.0.4.2\n192.168.1.2",
}

export const UNREAD_NOTIFICATIONS = ACTIVE_ALERTS_COUNT
