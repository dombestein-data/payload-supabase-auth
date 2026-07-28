import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { resolveLinkedUser } from '../src/index.js'

const createPayload = (docs: Record<string, unknown>[]) =>
  ({
    find: vi.fn().mockResolvedValue({ docs }),
  }) as unknown as Payload

describe('resolveLinkedUser', () => {
  it('looks up a linked user with access bypassed', async () => {
    const user = { id: 'payload-user-1', supabaseUserId: 'supabase-user-1' }
    const payload = createPayload([user])

    await expect(
      resolveLinkedUser(payload, {
        authCollection: 'users',
        subject: 'supabase-user-1',
      }),
    ).resolves.toBe(user)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'users',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      pagination: false,
      where: {
        supabaseUserId: {
          equals: 'supabase-user-1',
        },
      },
    })
  })

  it('returns null when no linked user exists', async () => {
    await expect(
      resolveLinkedUser(createPayload([]), {
        authCollection: 'users',
        subject: 'missing',
      }),
    ).resolves.toBeNull()
  })

  it('fails closed when a subject is linked more than once', async () => {
    await expect(
      resolveLinkedUser(createPayload([{ id: 'one' }, { id: 'two' }]), {
        authCollection: 'users',
        subject: 'duplicated',
      }),
    ).rejects.toThrow('Multiple users')
  })
})
