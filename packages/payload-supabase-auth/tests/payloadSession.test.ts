import type { Payload } from 'payload'
import { decodeJwt } from 'jose'
import { describe, expect, it, vi } from 'vitest'

import { createPayloadSession, createPayloadSessionCookie } from '../src/index.js'

describe('createPayloadSessionCookie', () => {
  it('creates a hardened Payload-compatible cookie', () => {
    const cookie = createPayloadSessionCookie({
      cookiePrefix: 'payload',
      domain: 'example.com',
      expires: new Date('2026-07-29T12:00:00.000Z'),
      sameSite: 'Lax',
      secure: true,
      token: 'header.payload.signature',
    })

    expect(cookie).toBe(
      'payload-token=header.payload.signature; Path=/; ' +
        'Expires=Wed, 29 Jul 2026 12:00:00 GMT; HttpOnly; ' +
        'Domain=example.com; Secure; SameSite=Lax',
    )
  })
})

describe('createPayloadSession', () => {
  it('persists a session and signs a Payload JWT containing its ID', async () => {
    const user = {
      email: 'editor@example.com',
      id: 42,
      sessions: [{ expiresAt: '2020-01-01T00:00:00.000Z', id: 'expired' }],
    }
    const update = vi.fn(async ({ data }) => ({ ...user, ...data }))
    const payload = {
      collections: {
        users: {
          config: {
            auth: {
              cookies: { domain: '', sameSite: 'Lax', secure: true },
              tokenExpiration: 3600,
              useSessions: true,
            },
            fields: [],
            slug: 'users',
          },
        },
      },
      config: { cookiePrefix: 'payload' },
      findByID: vi.fn().mockResolvedValue(user),
      secret: 'a-secure-test-secret',
      update,
    } as unknown as Payload

    const result = await createPayloadSession({
      authCollection: 'users',
      payload,
      userId: 42,
    })
    const claims = decodeJwt(result.token)

    expect(claims).toMatchObject({
      collection: 'users',
      email: 'editor@example.com',
      id: 42,
      sid: expect.any(String),
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: {
          sessions: [expect.objectContaining({ id: claims.sid })],
        },
        id: 42,
        overrideAccess: true,
      }),
    )
    expect(result.cookie).toContain('HttpOnly')
    expect(result.cookie).toContain('Secure')
  })

  it('does not persist a session when Payload sessions are disabled', async () => {
    const payload = {
      collections: {
        users: {
          config: {
            auth: {
              cookies: { domain: '', sameSite: 'Lax', secure: false },
              tokenExpiration: 3600,
              useSessions: false,
            },
            fields: [],
            slug: 'users',
          },
        },
      },
      config: { cookiePrefix: 'payload' },
      findByID: vi.fn().mockResolvedValue({
        email: 'editor@example.com',
        id: 'user-1',
      }),
      secret: 'a-secure-test-secret',
      update: vi.fn(),
    } as unknown as Payload

    const result = await createPayloadSession({
      authCollection: 'users',
      payload,
      userId: 'user-1',
    })

    expect(payload.update).not.toHaveBeenCalled()
    expect(decodeJwt(result.token).sid).toBeUndefined()
  })
})
