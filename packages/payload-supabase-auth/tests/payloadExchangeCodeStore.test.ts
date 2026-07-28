import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { createPayloadExchangeCodeStore } from '../src/index.js'

const createPayload = (returned: unknown[][] = []) => {
  const returning = vi.fn()
  for (const value of returned) {
    returning.mockResolvedValueOnce(value)
  }
  const where = vi.fn(() => ({ returning }))
  const remove = vi.fn(() => ({ where }))
  const create = vi.fn().mockResolvedValue({ id: 1 })
  const payload = {
    create,
    db: {
      drizzle: { delete: remove },
      tables: {
        supabase_exchange_codes: {
          digest: 'digest-column',
          expiresAt: 'expires-at-column',
        },
        custom_codes: {
          digest: 'digest-column',
          expiresAt: 'expires-at-column',
        },
      },
    },
  } as unknown as Payload
  return { create, payload, remove, returning, where }
}

describe('createPayloadExchangeCodeStore', () => {
  it('stores digests using access override and preserves numeric IDs', async () => {
    const { create, payload } = createPayload()
    const store = createPayloadExchangeCodeStore(payload)
    const expiresAt = new Date('2026-07-28T10:01:00.000Z')

    await store.create({
      authCollection: 'users',
      digest: 'digest',
      expiresAt,
      userId: 42,
    })

    expect(create).toHaveBeenCalledWith({
      collection: 'supabase-exchange-codes',
      data: {
        authCollection: 'users',
        digest: 'digest',
        expiresAt: expiresAt.toISOString(),
        userId: '42',
        userIdType: 'number',
      },
      depth: 0,
      overrideAccess: true,
    })
  })

  it('returns a record only after winning its deletion', async () => {
    const doc = {
      authCollection: 'users',
      digest: 'digest',
      expiresAt: '2026-07-28T10:01:00.000Z',
      id: 1,
      userId: '42',
      userIdType: 'number',
    }
    const { payload } = createPayload([[doc], []])
    const store = createPayloadExchangeCodeStore(payload)
    const now = new Date('2026-07-28T10:00:00.000Z')

    await expect(store.consume('digest', now)).resolves.toMatchObject({
      userId: 42,
    })
    await expect(store.consume('digest', now)).resolves.toBeNull()
  })

  it('does not delete a missing or expired record', async () => {
    const { payload, returning } = createPayload([[]])
    const store = createPayloadExchangeCodeStore(payload)

    await expect(store.consume('missing', new Date())).resolves.toBeNull()
    expect(returning).toHaveBeenCalledOnce()
  })

  it('cleans up expired records', async () => {
    const { payload, remove } = createPayload([[{ id: 1 }, { id: 2 }]])
    const store = createPayloadExchangeCodeStore(payload, 'custom-codes')
    const now = new Date('2026-07-28T10:00:00.000Z')

    await expect(store.cleanupExpired(now)).resolves.toBe(2)
    expect(remove).toHaveBeenCalledOnce()
  })
})
