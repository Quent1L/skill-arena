import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import http, { API_VERSION, API_VERSION_HEADER } from '@/config/ApiConfig'

/**
 * The version header is what pins this client to an API major, so a request that
 * loses it silently gets served whatever the server considers latest — exactly the
 * breakage the negotiation exists to prevent.
 */
describe('ApiConfig version negotiation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const sentHeaders = () => {
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    return new Headers((init as RequestInit).headers)
  }

  it('sends the API version on every request', async () => {
    await http.get('/api/config')

    expect(sentHeaders().get(API_VERSION_HEADER)).toBe(API_VERSION)
  })

  it('keeps the headers the caller passed', async () => {
    await http.post('/api/config', {}, { headers: { 'X-Test': 'kept' } })

    const headers = sentHeaders()
    expect(headers.get('X-Test')).toBe('kept')
    expect(headers.get(API_VERSION_HEADER)).toBe(API_VERSION)
  })

  it('pins a major version, not the app version', () => {
    expect(API_VERSION).toMatch(/^v\d+$/)
  })
})
