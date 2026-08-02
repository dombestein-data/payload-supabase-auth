import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import { createExchangeEndpoint } from '../src/index.js'

const endpoint = createExchangeEndpoint({ authCollection: 'users' })

describe('createExchangeEndpoint', () => {
  it('rejects requests without an allowed Origin', async () => {
    const response = await endpoint.handler({
      data: { code: 'opaque-code' },
      headers: new Headers(),
      url: 'https://cms.example.com/api/supabase/exchange',
    } as unknown as PayloadRequest)

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('parses JSON and rejects a missing code without touching storage', async () => {
    const request = new Request('https://cms.example.com/api/supabase/exchange', {
      body: JSON.stringify({}),
      headers: {
        'content-type': 'application/json',
        origin: 'https://cms.example.com',
      },
      method: 'POST',
    })
    const response = await endpoint.handler(request as PayloadRequest)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: 'Invalid or expired exchange code',
    })
  })
})
