import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { createSupabaseStrategy } from '../src/index.js'

const payload = {
  collections: {
    users: {
      config: {
        auth: { depth: 2 },
      },
    },
  },
} as unknown as Payload

describe('createSupabaseStrategy', () => {
  it('authenticates a linked user from a bearer token', async () => {
    const user = { id: 'payload-user-1' }
    const verifyToken = vi.fn().mockResolvedValue({ sub: 'supabase-user-1' })
    const resolveUser = vi.fn().mockResolvedValue(user)
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      resolveUser,
      verifyToken,
    })

    const result = await strategy.authenticate({
      headers: new Headers({ authorization: 'Bearer access-token' }),
      payload,
      strategyName: strategy.name,
    })

    expect(verifyToken).toHaveBeenCalledWith('access-token')
    expect(resolveUser).toHaveBeenCalledWith(payload, {
      authCollection: 'users',
      depth: 2,
      subject: 'supabase-user-1',
      userIdField: undefined,
    })
    expect(result.user).toBe(user)
    expect(result.user).toMatchObject({
      _strategy: 'supabase-bearer',
      collection: 'users',
    })
  })

  it('does not verify requests without a bearer token', async () => {
    const verifyToken = vi.fn()
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      verifyToken,
    })

    await expect(
      strategy.authenticate({ headers: new Headers(), payload }),
    ).resolves.toEqual({ user: null })
    expect(verifyToken).not.toHaveBeenCalled()
  })

  it.each(['invalid token', 'unlinked user'])(
    'fails closed for an %s',
    async (scenario) => {
      const verifyToken =
        scenario === 'invalid token'
          ? vi.fn().mockRejectedValue(new Error('invalid'))
          : vi.fn().mockResolvedValue({ sub: 'supabase-user-1' })
      const resolveUser = vi.fn().mockResolvedValue(null)
      const strategy = createSupabaseStrategy({
        authCollection: 'users',
        resolveUser,
        verifyToken,
      })

      await expect(
        strategy.authenticate({
          headers: new Headers({ authorization: 'Bearer token' }),
          payload,
        }),
      ).resolves.toEqual({ user: null })
    },
  )

  it('uses depth zero for GraphQL authentication', async () => {
    const resolveUser = vi.fn().mockResolvedValue(null)
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      resolveUser,
      verifyToken: vi.fn().mockResolvedValue({ sub: 'subject' }),
    })

    await strategy.authenticate({
      headers: new Headers({ authorization: 'Bearer token' }),
      isGraphQL: true,
      payload,
    })

    expect(resolveUser).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ depth: 0 }),
    )
  })

  it('provisions an unlinked user when enabled', async () => {
    const provisioned = { id: 'new-user' }
    const provisionUser = vi.fn().mockResolvedValue(provisioned)
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      provisionUser,
      provisionUsers: true,
      resolveUser: vi.fn().mockResolvedValue(null),
      verifyToken: vi.fn().mockResolvedValue({
        email: 'new@example.com',
        sub: 'subject',
      }),
    })

    const result = await strategy.authenticate({
      headers: new Headers({ authorization: 'Bearer token' }),
      payload,
    })

    expect(provisionUser).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        authCollection: 'users',
        claims: expect.objectContaining({ sub: 'subject' }),
      }),
    )
    expect(result.user).toMatchObject({
      id: 'new-user',
      collection: 'users',
    })
  })

  it('synchronizes a linked user when enabled', async () => {
    const synchronized = { id: 'user', email: 'new@example.com' }
    const synchronizeUser = vi.fn().mockResolvedValue(synchronized)
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      resolveUser: vi.fn().mockResolvedValue({
        id: 'user',
        email: 'old@example.com',
      }),
      synchronizeUser,
      synchronizeUsers: true,
      verifyToken: vi.fn().mockResolvedValue({
        email: 'new@example.com',
        sub: 'subject',
      }),
    })

    const result = await strategy.authenticate({
      headers: new Headers({ authorization: 'Bearer token' }),
      payload,
    })

    expect(synchronizeUser).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        claims: expect.objectContaining({ sub: 'subject' }),
        user: expect.objectContaining({ id: 'user' }),
      }),
    )
    expect(result.user).toMatchObject({
      email: 'new@example.com',
      collection: 'users',
    })
  })
})
