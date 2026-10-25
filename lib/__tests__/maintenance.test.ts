import { afterEach, describe, expect, it, vi } from 'vitest'

import { isMaintenanceMode, maintenanceResponse } from '../maintenance'

describe('maintenance mode', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is on only when MAINTENANCE_MODE is "true"', () => {
    vi.stubEnv('MAINTENANCE_MODE', '')
    expect(isMaintenanceMode()).toBe(false)
    vi.stubEnv('MAINTENANCE_MODE', '1')
    expect(isMaintenanceMode()).toBe(false)
    vi.stubEnv('MAINTENANCE_MODE', 'true')
    expect(isMaintenanceMode()).toBe(true)
  })

  it('serves an HTML page with 503 for pages', async () => {
    const response = maintenanceResponse('/search/abc')
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('600')
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('maintenance')
  })

  it('serves JSON with 503 for API routes', async () => {
    const response = maintenanceResponse('/api/chat')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Service under maintenance'
    })
  })
})
