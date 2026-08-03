import { describe, expect, it, vi } from 'vitest'

import { createSupabaseMfaVerifier } from '../src/index.js'

const claims = {
  aud: 'authenticated',
  exp: 2_000_000_000,
  iss: 'https://project.supabase.co/auth/v1',
  sub: 'user-id',
} as const

const createResponse = (body: unknown, ok = true): Response =>
  ({ json: vi.fn().mockResolvedValue(body), ok }) as unknown as Response

describe('createSupabaseMfaVerifier', () => {
  it('returns the original verifier when MFA is disabled', () => {
    const verifyToken = vi.fn()

    expect(createSupabaseMfaVerifier({ policy: 'disabled', verifyToken })).toBe(verifyToken)
  })

  it('requires an AAL2 token when MFA is globally required', async () => {
    const verifier = createSupabaseMfaVerifier({
      policy: 'required',
      verifyToken: vi.fn().mockResolvedValue({ ...claims, aal: 'aal1' }),
    })

    await expect(verifier('token')).rejects.toThrow('MFA verification is required')
  })

  it('allows AAL1 when the user has no verified factor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        createResponse({ factors: [{ factor_type: 'totp', id: 'factor', status: 'unverified' }] }),
      )
    const verifier = createSupabaseMfaVerifier({
      fetch,
      policy: 'if-enrolled',
      publishableKey: 'public-key',
      supabaseUrl: 'https://project.supabase.co',
      verifyToken: vi.fn().mockResolvedValue({ ...claims, aal: 'aal1' }),
    })

    await expect(verifier('token')).resolves.toMatchObject({ sub: 'user-id' })
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://project.supabase.co/auth/v1/user'),
      expect.objectContaining({
        headers: {
          apikey: 'public-key',
          authorization: 'Bearer token',
        },
      }),
    )
  })

  it('requires AAL2 when the user has a verified factor', async () => {
    const verifier = createSupabaseMfaVerifier({
      fetch: vi
        .fn()
        .mockResolvedValue(createResponse({ factors: [{ id: 'factor', status: 'verified' }] })),
      policy: 'if-enrolled',
      publishableKey: 'public-key',
      supabaseUrl: 'https://project.supabase.co',
      verifyToken: vi.fn().mockResolvedValue({ ...claims, aal: 'aal1' }),
    })

    await expect(verifier('token')).rejects.toThrow('MFA verification is required')
  })

  it('accepts AAL2 without an enrollment lookup', async () => {
    const fetch = vi.fn()
    const verifier = createSupabaseMfaVerifier({
      fetch,
      policy: 'if-enrolled',
      publishableKey: 'public-key',
      supabaseUrl: 'https://project.supabase.co',
      verifyToken: vi.fn().mockResolvedValue({ ...claims, aal: 'aal2' }),
    })

    await expect(verifier('token')).resolves.toMatchObject({ aal: 'aal2' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed when Supabase cannot report enrollment', async () => {
    const verifier = createSupabaseMfaVerifier({
      fetch: vi.fn().mockResolvedValue(createResponse({}, false)),
      policy: 'if-enrolled',
      publishableKey: 'public-key',
      supabaseUrl: 'https://project.supabase.co',
      verifyToken: vi.fn().mockResolvedValue({ ...claims, aal: 'aal1' }),
    })

    await expect(verifier('token')).rejects.toThrow('determine Supabase MFA enrollment')
  })

  it('fails authentication when adaptive MFA configuration is incomplete', async () => {
    const verifier = createSupabaseMfaVerifier({
      policy: 'if-enrolled',
      supabaseUrl: 'https://project.supabase.co',
      verifyToken: vi.fn(),
    })

    await expect(verifier('token')).rejects.toThrow('requires both')
  })
})
