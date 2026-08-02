import { describe, expect, it, vi } from 'vitest'

import { createSupabaseAdminSession } from '../src/admin/createAdminSession.js'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })

describe('createSupabaseAdminSession', () => {
  it('exchanges a Supabase password login for a Payload session', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'supabase-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ code: 'one-time-code' }))
      .mockResolvedValueOnce(jsonResponse({ user: { id: '1' } }))

    await createSupabaseAdminSession({
      email: 'admin@example.com',
      exchangeCodeEndpoint: '/api/supabase/exchange-code',
      exchangeEndpoint: '/api/supabase/exchange',
      fetch,
      password: 'password',
      publishableKey: 'public-key',
      supabaseUrl: 'https://project.supabase.co',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      new URL('https://project.supabase.co/auth/v1/token?grant_type=password'),
      expect.objectContaining({
        body: JSON.stringify({ email: 'admin@example.com', password: 'password' }),
        headers: {
          apikey: 'public-key',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/supabase/exchange-code', {
      credentials: 'same-origin',
      headers: { Authorization: 'Bearer supabase-access-token' },
      method: 'POST',
    })
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/supabase/exchange', {
      body: JSON.stringify({ code: 'one-time-code' }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it('returns a generic error for rejected Supabase credentials', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        jsonResponse({ error_description: 'User details that should not be displayed' }, 400),
      )

    await expect(
      createSupabaseAdminSession({
        email: 'admin@example.com',
        exchangeCodeEndpoint: '/api/supabase/exchange-code',
        exchangeEndpoint: '/api/supabase/exchange',
        fetch,
        password: 'wrong',
        publishableKey: 'public-key',
        supabaseUrl: 'https://project.supabase.co',
      }),
    ).rejects.toThrow('email or password is incorrect')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not exchange when Payload cannot issue a one-time code', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'supabase-access-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401))

    await expect(
      createSupabaseAdminSession({
        email: 'admin@example.com',
        exchangeCodeEndpoint: '/api/supabase/exchange-code',
        exchangeEndpoint: '/api/supabase/exchange',
        fetch,
        password: 'password',
        publishableKey: 'public-key',
        supabaseUrl: 'https://project.supabase.co',
      }),
    ).rejects.toThrow('could not start a session')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
