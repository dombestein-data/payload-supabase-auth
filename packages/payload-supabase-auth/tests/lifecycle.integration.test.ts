import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  createSupabaseStrategy,
  provisionUser,
  resolveLinkedUser,
  synchronizeUser,
  type SupabaseJwtClaims,
} from '../src/index.js'

type StoredUser = {
  id: string
  email: string
  supabaseUserId: string
}

const createStatefulPayload = () => {
  const users: StoredUser[] = []
  const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const subject = (
      where.supabaseUserId as { equals?: string } | undefined
    )?.equals
    return {
      docs: users.filter((user) => user.supabaseUserId === subject).slice(0, 2),
    }
  })
  const create = vi.fn(
    async ({ data }: { data: Omit<StoredUser, 'id'> & { password: string } }) => {
      // Yield so concurrent authentication attempts can both complete their
      // initial lookup before the unique write is enforced.
      await Promise.resolve()
      if (users.some((user) => user.supabaseUserId === data.supabaseUserId)) {
        throw new Error('unique constraint violation')
      }
      const user = {
        id: `user-${users.length + 1}`,
        email: data.email,
        supabaseUserId: data.supabaseUserId,
      }
      users.push(user)
      return user
    },
  )
  const update = vi.fn(
    async ({ data, id }: { data: Partial<StoredUser>; id: string }) => {
      const user = users.find((candidate) => candidate.id === id)
      if (!user) {
        throw new Error('missing user')
      }
      Object.assign(user, data)
      return user
    },
  )
  const payload = {
    collections: {
      users: { config: { auth: { depth: 0 } } },
    },
    create,
    find,
    update,
  } as unknown as Payload

  return { create, find, payload, update, users }
}

const authenticate = (
  strategy: ReturnType<typeof createSupabaseStrategy>,
  payload: Payload,
) =>
  strategy.authenticate({
    headers: new Headers({ authorization: 'Bearer token' }),
    payload,
  })

describe('provisioning and synchronization integration', () => {
  it('provisions once, resolves thereafter, and synchronizes changed claims', async () => {
    const state = createStatefulPayload()
    let claims: SupabaseJwtClaims = {
      email: 'first@example.com',
      sub: 'supabase-user-1',
    }
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      provisionUsers: true,
      synchronizeUsers: true,
      verifyToken: vi.fn(async () => claims),
    })

    const first = await authenticate(strategy, state.payload)
    const second = await authenticate(strategy, state.payload)
    claims = { ...claims, email: 'changed@example.com' }
    const third = await authenticate(strategy, state.payload)
    await authenticate(strategy, state.payload)

    expect(first.user?.id).toBe('user-1')
    expect(second.user?.id).toBe('user-1')
    expect(third.user?.email).toBe('changed@example.com')
    expect(state.users).toHaveLength(1)
    expect(state.create).toHaveBeenCalledTimes(1)
    expect(state.update).toHaveBeenCalledTimes(1)
  })

  it('recovers from concurrent provisioning through the unique link', async () => {
    const state = createStatefulPayload()
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      provisionUsers: true,
      verifyToken: vi.fn().mockResolvedValue({
        email: 'same@example.com',
        sub: 'same-subject',
      }),
    })

    const results = await Promise.all([
      authenticate(strategy, state.payload),
      authenticate(strategy, state.payload),
    ])

    expect(state.users).toHaveLength(1)
    expect(results[0].user?.id).toBe('user-1')
    expect(results[1].user?.id).toBe('user-1')
  })

  it.each([
    'invalid signature',
    'wrong issuer',
    'wrong audience',
    'expired token',
  ])('does not write for a rejected %s', async () => {
    const state = createStatefulPayload()
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      provisionUsers: true,
      synchronizeUsers: true,
      verifyToken: vi.fn().mockRejectedValue(new Error('rejected')),
    })

    await expect(authenticate(strategy, state.payload)).resolves.toEqual({
      user: null,
    })
    expect(state.create).not.toHaveBeenCalled()
    expect(state.update).not.toHaveBeenCalled()
  })

  it('fails cleanly without email and performs no write', async () => {
    const state = createStatefulPayload()
    const strategy = createSupabaseStrategy({
      authCollection: 'users',
      provisionUsers: true,
      verifyToken: vi.fn().mockResolvedValue({ sub: 'no-email' }),
    })

    await expect(authenticate(strategy, state.payload)).resolves.toEqual({
      user: null,
    })
    expect(state.users).toHaveLength(0)
  })

  it('uses access override for every lifecycle database operation', async () => {
    const state = createStatefulPayload()
    const claims = {
      email: 'new@example.com',
      sub: 'subject',
    }
    const provisioned = await provisionUser(state.payload, {
      authCollection: 'users',
      claims,
    })
    await resolveLinkedUser(state.payload, {
      authCollection: 'users',
      subject: claims.sub,
    })
    await synchronizeUser(state.payload, {
      authCollection: 'users',
      claims: { ...claims, email: 'updated@example.com' },
      user: provisioned,
    })

    expect(state.find).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    )
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    )
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    )
  })
})
