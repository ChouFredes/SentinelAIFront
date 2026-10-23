// Datos simulados del backend, en memoria. Los endpoints que todavía no existen
// (ver docs/backend-pendiente.md) responden siempre desde acá; el resto solo con
// SENTINEL_USE_MOCKS=true. PUT config y revert mutan este estado, así que la demo
// reacciona; en Vercel se reinicia con cada instancia fría.
import { ipInCidrs, normalizeCidr, MAX_KNOWN_DEVICES } from "@/lib/cidr"
import { QUARANTINE_SECONDS, TAU } from "@/lib/domain"
import { BackendError } from "@/lib/server/errors"
import type {
  AdminQuarantineView,
  AlertView,
  FlowSample,
  ManualReversionResponse,
  MitigationEvent,
  SensorTelemetryView,
  Severity,
  SiteConfigUpdate,
  SiteConfigView,
  SiteSensorView,
  SiteView,
} from "@/lib/api/schemas"

const DAY = 86_400_000
/** Piso de "critical" en los mocks (el backend usa max(3τ, piso)). */
const CRITICAL_FLOOR = 0.005

const SITES = [
  { id: 1, slug: "deposito-central", name: "Depósito central", is_active: true },
  { id: 2, slug: "sucursal-norte", name: "Sucursal Norte", is_active: true },
  { id: 3, slug: "sucursal-sur", name: "Sucursal Sur", is_active: true },
]

const SENSORS = [
  { sensor_id: 7, site_id: 1, name: "SN-0007", heartbeatAgo: 12, ingestAgo: 4, flows: 482_113, degraded: false },
  // Sin heartbeat: como el sensor Edge, que solo envía flujos.
  { sensor_id: 12, site_id: 2, name: "SN-0012", heartbeatAgo: null, ingestAgo: 9, flows: 233_870, degraded: false },
  { sensor_id: 21, site_id: 3, name: "SN-0021", heartbeatAgo: 8, ingestAgo: 3, flows: 310_552, degraded: false },
  { sensor_id: 22, site_id: 3, name: "SN-0022", heartbeatAgo: 31, ingestAgo: 17, flows: 98_240, degraded: true },
]

const PUBLIC_SOURCES = [
  "203.0.113.45",
  "198.51.100.7",
  "45.33.10.2",
  "185.12.4.9",
  "192.0.2.88",
  "198.51.100.101",
  "203.0.113.200",
  "185.12.4.77",
]
const DEST_PORTS = [3389, 22, 443, 445, 80, 53, 8080]

const FEATURE_NAMES = [
  "Flow Duration",
  "Total Fwd Packets",
  "Total Backward Packets",
  "Total Length of Fwd Packets",
  "Total Length of Bwd Packets",
  "Fwd Packet Length Max",
  "Fwd Packet Length Mean",
  "Bwd Packet Length Max",
  "Flow Bytes/s",
  "Flow Packets/s",
  "Flow IAT Mean",
  "Flow IAT Std",
  "Fwd IAT Total",
  "FIN Flag Count",
  "SYN Flag Count",
  "RST Flag Count",
  "PSH Flag Count",
  "ACK Flag Count",
  "Init_Win_bytes_forward",
  "Subflow Fwd Bytes",
]

interface ActiveQuarantine extends AdminQuarantineView {
  apply_event_id: number
}

interface Store {
  alerts: AlertView[]
  events: MitigationEvent[]
  quarantines: ActiveQuarantine[]
  configs: Map<number, SiteConfigView>
  nextAlertId: number
  nextEventId: number
  lastSpawnAt: number
  rng: () => number
}

function makeRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const iso = (ms: number) => new Date(ms).toISOString()

function initialConfigs(): Map<number, SiteConfigView> {
  return new Map<number, SiteConfigView>([
    [1, { site_id: 1, custom_mse_threshold: null, active_response_enabled: true, informative_only_mode: false, known_devices: ["192.168.1.0/27"] }],
    [2, { site_id: 2, custom_mse_threshold: null, active_response_enabled: false, informative_only_mode: true, known_devices: ["192.168.2.0/27", "192.168.2.9/32"] }],
    [3, { site_id: 3, custom_mse_threshold: 0.0004, active_response_enabled: true, informative_only_mode: false, known_devices: ["192.168.3.0/27"] }],
  ])
}

function severityOf(mse: number): Severity {
  if (mse >= CRITICAL_FLOOR) return "critical"
  if (mse >= 3 * TAU) return "high"
  return "warning"
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)]
}

function sensorFor(rng: () => number, siteId: number): number {
  const options = SENSORS.filter((s) => s.site_id === siteId)
  return pick(rng, options).sensor_id
}

interface NewAlert {
  siteId: number
  at: number
  source: string
  mse?: number
  forceMitigation?: boolean
}

function createAlert(st: Store, a: NewAlert): AlertView {
  const cfg = st.configs.get(a.siteId)!
  const threshold = cfg.custom_mse_threshold ?? TAU
  const mse = a.mse ?? threshold * (1.05 + Math.pow(st.rng(), 3) * 80)
  const severity = severityOf(mse)
  const sensorId = a.forceMitigation
    ? SENSORS.find((s) => s.site_id === a.siteId && !s.degraded)!.sensor_id
    : sensorFor(st.rng, a.siteId)
  const sensor = SENSORS.find((s) => s.sensor_id === sensorId)!
  const isPrivate = a.source.startsWith("192.168.")
  const linkDegraded = !a.forceMitigation && sensor.degraded && st.rng() < 0.35
  const mitigated =
    cfg.active_response_enabled &&
    !cfg.informative_only_mode &&
    !linkDegraded &&
    !isPrivate &&
    (a.forceMitigation || severity !== "warning")
  const alert: AlertView = {
    id: st.nextAlertId++,
    site_id: a.siteId,
    sensor_id: sensorId,
    source_ip: a.source,
    destination_ip: `192.168.${a.siteId}.${pick(st.rng, [2, 5, 10, 12, 20, 25])}`,
    destination_port: pick(st.rng, DEST_PORTS),
    mse_score: mse,
    severity,
    anomaly: true,
    unrecognized_device: isPrivate && !ipInCidrs(a.source, cfg.known_devices),
    link_degraded: linkDegraded,
    informative_only_mode: cfg.informative_only_mode,
    mitigation_applied: mitigated,
    occurred_at: iso(a.at),
  }
  st.alerts.push(alert)
  return alert
}

function applyMitigation(st: Store, alert: AlertView, now: number): void {
  const applyAt = Date.parse(alert.occurred_at) + 1000
  const apply: MitigationEvent = {
    id: st.nextEventId++,
    site_id: alert.site_id,
    sensor_id: alert.sensor_id,
    event_type: "APPLY",
    original_event_id: null,
    source_ip: alert.source_ip,
    destination_ip: alert.destination_ip,
    destination_port: alert.destination_port,
    mse_score: alert.mse_score,
    reason: null,
    occurred_at: iso(applyAt),
  }
  st.events.push(apply)
  const expiresAt = applyAt + QUARANTINE_SECONDS * 1000
  if (expiresAt > now) {
    st.quarantines.push({
      site_id: alert.site_id,
      source_ip: alert.source_ip,
      destination_ip: alert.destination_ip,
      destination_port: alert.destination_port,
      mse_score: alert.mse_score,
      quarantined_at: apply.occurred_at,
      expires_at: iso(expiresAt),
      apply_event_id: apply.id,
    })
    return
  }
  const manual = st.rng() < 0.15
  const at = manual ? applyAt + 10_000 + Math.floor(st.rng() * 40_000) : expiresAt
  st.events.push({
    ...apply,
    id: st.nextEventId++,
    event_type: manual ? "MANUAL_REVERSION" : "REVERSION",
    original_event_id: apply.id,
    reason: manual ? "administrator_manual_reversion" : "quarantine_timer_elapsed",
    occurred_at: iso(at),
  })
}

function spawnDetection(st: Store, now: number, secondsAgo = 0): void {
  const siteId = pick(st.rng, [1, 3])
  const mse = 0.004 + st.rng() * 0.02
  const alert = createAlert(st, {
    siteId,
    at: now - secondsAgo * 1000,
    source: pick(st.rng, PUBLIC_SOURCES),
    mse,
    forceMitigation: true,
  })
  if (alert.mitigation_applied) applyMitigation(st, alert, now)
  st.lastSpawnAt = now
}

function build(now: number): Store {
  const st: Store = {
    alerts: [],
    events: [],
    quarantines: [],
    configs: initialConfigs(),
    nextAlertId: 1001,
    nextEventId: 1,
    lastSpawnAt: now,
    rng: makeRng(20261019),
  }
  const times = Array.from({ length: 120 }, () => now - 90_000 - st.rng() * 7 * DAY).sort((a, b) => a - b)
  for (const at of times) {
    const siteId = pick(st.rng, [1, 1, 2, 3, 3])
    const cfg = st.configs.get(siteId)!
    const roll = st.rng()
    let source: string
    if (roll < 0.68) source = pick(st.rng, PUBLIC_SOURCES)
    else if (roll < 0.82) source = `192.168.${siteId}.${pick(st.rng, [3, 14, 22, 30])}`
    else source = `192.168.${siteId}.${pick(st.rng, [41, 66, 87, 150])}`
    void cfg
    const alert = createAlert(st, { siteId, at, source })
    if (alert.mitigation_applied) applyMitigation(st, alert, now)
  }
  // Dos detecciones recientes para que haya cuarentenas con cuenta regresiva.
  spawnDetection(st, now, 12)
  spawnDetection(st, now, 30)
  return st
}

const g = globalThis as unknown as { __sentinelMockStore?: Store }

function store(now = Date.now()): Store {
  const st = (g.__sentinelMockStore ??= build(now))
  tick(st, now)
  return st
}

/** Simula el motor: vence cuarentenas (REVERSION) y, si no queda ninguna, detecta una nueva. */
function tick(st: Store, now: number): void {
  for (const q of [...st.quarantines]) {
    if (Date.parse(q.expires_at) > now) continue
    const apply = st.events.find((e) => e.id === q.apply_event_id)!
    st.events.push({
      ...apply,
      id: st.nextEventId++,
      event_type: "REVERSION",
      original_event_id: apply.id,
      reason: "quarantine_timer_elapsed",
      occurred_at: q.expires_at,
    })
    st.quarantines.splice(st.quarantines.indexOf(q), 1)
  }
  if (st.quarantines.length === 0 && now - st.lastSpawnAt > 90_000) spawnDetection(st, now)
}

// --- Lecturas ---------------------------------------------------------------

export function mockSites(): SiteView[] {
  const st = store()
  return SITES.map((s) => ({ ...s, config: st.configs.get(s.id)! }))
}

export function mockSiteConfig(siteId: number): SiteConfigView {
  const cfg = store().configs.get(siteId)
  if (!cfg) throw new BackendError(404, "Sitio no encontrado")
  return cfg
}

export function mockUpdateSiteConfig(siteId: number, update: SiteConfigUpdate): SiteConfigView {
  const st = store()
  const cfg = st.configs.get(siteId)
  if (!cfg) throw new BackendError(404, "Sitio no encontrado")
  let devices = cfg.known_devices
  if (update.known_devices) {
    if (update.known_devices.length > MAX_KNOWN_DEVICES) {
      throw new BackendError(422, `known_devices admite hasta ${MAX_KNOWN_DEVICES} rangos`)
    }
    const bad = update.known_devices.find((c) => normalizeCidr(c) === null)
    if (bad) throw new BackendError(422, `CIDR inválido: ${bad}`)
    devices = update.known_devices
  }
  const next: SiteConfigView = {
    ...cfg,
    custom_mse_threshold:
      update.custom_mse_threshold === undefined ? cfg.custom_mse_threshold : update.custom_mse_threshold,
    active_response_enabled: update.active_response_enabled ?? cfg.active_response_enabled,
    informative_only_mode: update.informative_only_mode ?? cfg.informative_only_mode,
    known_devices: devices,
  }
  st.configs.set(siteId, next)
  return next
}

export function mockTelemetry(sensorId: number, now = Date.now()): SensorTelemetryView {
  const s = SENSORS.find((x) => x.sensor_id === sensorId)
  if (!s) throw new BackendError(404, "Sensor no encontrado")
  return {
    sensor_id: s.sensor_id,
    site_id: s.site_id,
    is_active: true,
    last_heartbeat_at: s.heartbeatAgo === null ? null : iso(now - s.heartbeatAgo * 1000),
    last_ingest_at: iso(now - s.ingestAgo * 1000),
    flow_count: s.flows,
    last_link_degraded: s.degraded,
    last_link_report_at: iso(now - (s.heartbeatAgo ?? s.ingestAgo) * 1000),
  }
}

export function mockSiteSensors(siteId: number): SiteSensorView[] {
  return SENSORS.filter((s) => s.site_id === siteId).map((s) => ({
    ...mockTelemetry(s.sensor_id),
    name: s.name,
  }))
}

export interface MockAlertQuery {
  site_id?: number
  sensor_id?: number
  source_ip?: string
  severity?: Severity
}

/** Más reciente primero, igual que el backend. El resto de los filtros los aplica el BFF. */
export function mockAlerts(q: MockAlertQuery = {}): AlertView[] {
  return store()
    .alerts.filter(
      (a) =>
        (q.site_id === undefined || a.site_id === q.site_id) &&
        (q.sensor_id === undefined || a.sensor_id === q.sensor_id) &&
        (q.source_ip === undefined || a.source_ip === q.source_ip) &&
        (q.severity === undefined || a.severity === q.severity),
    )
    .sort((a, b) => b.id - a.id)
}

export function mockQuarantines(siteId?: number): AdminQuarantineView[] {
  return store()
    .quarantines.filter((q) => siteId === undefined || q.site_id === siteId)
    .map((q) => ({
      site_id: q.site_id,
      source_ip: q.source_ip,
      destination_ip: q.destination_ip,
      destination_port: q.destination_port,
      mse_score: q.mse_score,
      quarantined_at: q.quarantined_at,
      expires_at: q.expires_at,
    }))
}

export function mockMitigationEvents(q: { site_id?: number; source_ip?: string; limit?: number }): MitigationEvent[] {
  return store()
    .events.filter(
      (e) =>
        (q.site_id === undefined || e.site_id === q.site_id) &&
        (q.source_ip === undefined || e.source_ip === q.source_ip),
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, q.limit ?? 200)
}

export function mockRevert(sourceIp: string, siteId?: number): ManualReversionResponse {
  const st = store()
  const matches = st.quarantines.filter(
    (q) => q.source_ip === sourceIp && (siteId === undefined || q.site_id === siteId),
  )
  if (matches.length === 0) throw new BackendError(404, "No hay una cuarentena activa para esa IP")
  if (matches.length > 1) {
    throw new BackendError(409, "La IP está en cuarentena en varios sitios; indicá site_id")
  }
  const q = matches[0]
  const apply = st.events.find((e) => e.id === q.apply_event_id)!
  st.events.push({
    ...apply,
    id: st.nextEventId++,
    event_type: "MANUAL_REVERSION",
    original_event_id: apply.id,
    reason: "administrator_manual_reversion",
    occurred_at: iso(Date.now()),
  })
  st.quarantines.splice(st.quarantines.indexOf(q), 1)
  return { site_id: q.site_id, source_ip: q.source_ip, reverted: true, rule_was_present: true }
}

export function mockFlows(sensorId: number, limit = 20): FlowSample[] {
  const sensor = SENSORS.find((s) => s.sensor_id === sensorId)
  if (!sensor) throw new BackendError(404, "Sensor no encontrado")
  const rng = makeRng(sensorId * 7919)
  return Array.from({ length: limit }, () => {
    const pkts = 1 + Math.floor(rng() * 40)
    const features: Record<string, number> = {}
    for (const name of FEATURE_NAMES) {
      features[name] = name.endsWith("Flag Count") ? Math.floor(rng() * 3) : Math.round(rng() * 1_000_000) / (name.includes("/s") ? 10 : 1)
    }
    features["Total Fwd Packets"] = pkts
    features["Total Backward Packets"] = Math.max(1, Math.floor(pkts * (0.4 + rng() * 0.8)))
    return {
      source_ip: `192.168.${sensor.site_id}.${pick(rng, [3, 10, 14, 22, 33])}`,
      destination_ip: pick(rng, ["8.8.4.4", "52.96.1.18", "1.1.1.1", "142.250.78.14", `192.168.${sensor.site_id}.1`]),
      destination_port: pick(rng, [53, 443, 80, 123, 8080]),
      features,
    }
  })
}

/** Solo para tests: descarta el estado en memoria. */
export function resetMockStore(): void {
  delete g.__sentinelMockStore
}
