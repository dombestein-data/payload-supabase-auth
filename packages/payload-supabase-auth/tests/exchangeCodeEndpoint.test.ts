import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import { createExchangeCodeEndpoint } from '../src/index.js'

const endpoint = createExchangeCodeEndpoint({ authCollection: 'users' })

describe('createExchangeCodeEndpoint', () => {
  it('rejects requests without an allowed Origin', async () => {
    const response = await endpoint.handler({
      headers: new Headers({ authorization: 'Bearer token' }),
      url: 'https://cms.example.com/api/supabase/exchange-code',
    } as unknown as PayloadRequest)

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('requires a user authenticated by the Supabase strategy', async () => {
    const response = await endpoint.handler({
      headers: new Headers({ origin: 'https://cms.example.com' }),
      url: 'https://cms.example.com/api/supabase/exchange-code',
      user: null,
    } as unknown as PayloadRequest)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' })
  })

  it('rejects users authenticated by another strategy or collection', async () => {
    const request = {
      headers: new Headers({ origin: 'https://cms.example.com' }),
      url: 'https://cms.example.com/api/supabase/exchange-code',
      user: { _strategy: 'local-jwt', collection: 'users', id: 1 },
    } as unknown as PayloadRequest

    await expect(endpoint.handler(request)).resolves.toMatchObject({
      status: 401,
    })

    request.user = {
      _strategy: 'supabase-bearer',
      collection: 'admins',
      id: 1,
    } as never
    await expect(endpoint.handler(request)).resolves.toMatchObject({
      status: 401,
    })
  })
})
