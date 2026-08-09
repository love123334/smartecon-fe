import { apiConfig } from '@/api/config'
import type { SystemMetric } from '@/types'

interface HealthComponent {
  status?: string
  details?: Record<string, unknown>
}

interface ActuatorHealth {
  status?: string
  components?: Record<string, HealthComponent>
}

function mapStatus(raw?: string): SystemMetric['status'] {
  if (!raw) return 'warn'
  const s = raw.toUpperCase()
  if (s === 'UP') return 'ok'
  if (s === 'DOWN' || s === 'OUT_OF_SERVICE') return 'error'
  return 'warn'
}

function labelForComponent(key: string): string {
  const map: Record<string, string> = {
    ping: 'Spring Boot (ping)',
    db: 'PostgreSQL',
    diskSpace: 'Disk space',
    livenessState: 'Liveness',
    readinessState: 'Readiness',
  }
  return map[key] ?? key
}

export async function fetchSystemHealthMetrics(): Promise<SystemMetric[]> {
  const metrics: SystemMetric[] = []

  try {
    const res = await fetch(`${apiConfig.backendOrigin}/actuator/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    let body: ActuatorHealth | null = null
    try {
      body = (await res.json()) as ActuatorHealth
    } catch {
      body = null
    }

    const overall = body?.status ?? (res.ok ? 'UP' : 'DOWN')
    metrics.push({
      name: 'Backend API (Spring)',
      value: overall === 'UP' ? 'Online' : overall,
      status: mapStatus(overall),
    })

    if (body?.components) {
      for (const [key, comp] of Object.entries(body.components)) {
        if (key === 'ping') continue
        metrics.push({
          name: labelForComponent(key),
          value: comp.status ?? '—',
          status: mapStatus(comp.status),
        })
      }
    } else if (!res.ok) {
      metrics.push({
        name: 'HTTP',
        value: res.status,
        status: 'error',
      })
    }
  } catch {
    metrics.push({
      name: 'Backend API (Spring)',
      value: 'Offline',
      status: 'error',
    })
  }

  return metrics
}
