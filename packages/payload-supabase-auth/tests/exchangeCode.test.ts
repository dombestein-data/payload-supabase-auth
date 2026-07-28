import { describe, expect, it, vi } from 'vitest'

import {
  consumeExchangeCode,
  createExchangeCode,
  createMemoryExchangeCodeStore,
  digestExchangeCode,
  type ExchangeCodeStore,
} from '../src/index.js'

const now = new Date('2026-07-28T10:00:00.000Z')

describe('exchange codes', () => {
  it('stores only a digest and returns an opaque 256-bit code', async () => {
    const create = vi.fn()
    const store = { create } as unknown as ExchangeCodeStore

    const result = await createExchangeCode({
      authCollection: 'users',
      generateBytes: () => new Uint8Array(32).fill(7),
      now: () => now,
      store,
      userId: 'user-1',
    })

    expect(result.code).toHaveLength(43)
    expect(result.expiresAt.toISOString()).toBe('2026-07-28T10:01:00.000Z')
    expect(create).toHaveBeenCalledWith({
      authCollection: 'users',
      digest: digestExchangeCode(result.code),
      expiresAt: result.expiresAt,
      userId: 'user-1',
    })
    expect(JSON.stringify(create.mock.calls)).not.toContain(result.code)
  })

  it('consumes a valid code exactly once', async () => {
    const store = createMemoryExchangeCodeStore()
    const created = await createExchangeCode({
      authCollection: 'users',
      now: () => now,
      store,
      userId: 42,
    })

    await expect(
      consumeExchangeCode({ code: created.code, now: () => now, store }),
    ).resolves.toMatchObject({
      authCollection: 'users',
      userId: 42,
    })
    await expect(
      consumeExchangeCode({ code: created.code, now: () => now, store }),
    ).resolves.toBeNull()
  })

  it('rejects expired and unknown codes', async () => {
    const store = createMemoryExchangeCodeStore()
    const created = await createExchangeCode({
      authCollection: 'users',
      now: () => now,
      store,
      ttlMs: 1_000,
      userId: 'user-1',
    })

    await expect(
      consumeExchangeCode({
        code: created.code,
        now: () => new Date(now.getTime() + 1_000),
        store,
      }),
    ).resolves.toBeNull()
    await expect(
      consumeExchangeCode({ code: 'unknown', now: () => now, store }),
    ).resolves.toBeNull()
  })

  it('allows only one concurrent consumer', async () => {
    const store = createMemoryExchangeCodeStore()
    const created = await createExchangeCode({
      authCollection: 'users',
      now: () => now,
      store,
      userId: 'user-1',
    })

    const results = await Promise.all([
      consumeExchangeCode({ code: created.code, now: () => now, store }),
      consumeExchangeCode({ code: created.code, now: () => now, store }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('rejects unsafe TTLs and insufficient entropy', async () => {
    const store = createMemoryExchangeCodeStore()

    await expect(
      createExchangeCode({
        authCollection: 'users',
        store,
        ttlMs: 0,
        userId: 'user-1',
      }),
    ).rejects.toThrow('TTL')
    await expect(
      createExchangeCode({
        authCollection: 'users',
        generateBytes: () => new Uint8Array(16),
        store,
        userId: 'user-1',
      }),
    ).rejects.toThrow('256 bits')
  })
})
