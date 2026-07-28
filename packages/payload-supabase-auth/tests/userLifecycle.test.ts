import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { provisionUser, synchronizeUser } from '../src/index.js'

describe('provisionUser', () => {
  it('creates a linked user from verified claims', async () => {
    const user = { id: 'user-1', email: 'editor@example.com' }
    const payload = {
      create: vi.fn().mockResolvedValue(user),
    } as unknown as Payload

    await expect(
      provisionUser(payload, {
        authCollection: 'users',
        claims: {
          email: 'editor@example.com',
          sub: 'supabase-user-1',
        },
      }),
    ).resolves.toBe(user)

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'users',
      data: {
        email: 'editor@example.com',
        password: expect.any(String),
        supabaseUserId: 'supabase-user-1',
      },
      depth: 0,
      overrideAccess: true,
    })
    const data = vi.mocked(payload.create).mock.calls[0]?.[0].data
    expect((data as { password: string }).password.length).toBeGreaterThan(32)
  })

  it('supports custom claim mapping while protecting the subject link', async () => {
    const payload = {
      create: vi.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as Payload

    await provisionUser(payload, {
      authCollection: 'users',
      claims: {
        email: 'editor@example.com',
        sub: 'trusted-subject',
      },
      mapClaims: () => ({
        role: 'editor',
        supabaseUserId: 'untrusted-override',
      }),
    })

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'editor',
          supabaseUserId: 'trusted-subject',
        }),
      }),
    )
  })

  it('rejects provisioning without an email', async () => {
    await expect(
      provisionUser({} as Payload, {
        authCollection: 'users',
        claims: { sub: 'supabase-user-1' },
      }),
    ).rejects.toThrow('without an email claim')
  })
})

describe('synchronizeUser', () => {
  it('updates mapped fields that changed', async () => {
    const updatedUser = { id: 'user-1', email: 'new@example.com' }
    const payload = {
      update: vi.fn().mockResolvedValue(updatedUser),
    } as unknown as Payload

    await expect(
      synchronizeUser(payload, {
        authCollection: 'users',
        claims: { email: 'new@example.com', sub: 'supabase-user-1' },
        user: { id: 'user-1', email: 'old@example.com' } as never,
      }),
    ).resolves.toBe(updatedUser)

    expect(payload.update).toHaveBeenCalledWith({
      id: 'user-1',
      collection: 'users',
      data: { email: 'new@example.com' },
      depth: 0,
      overrideAccess: true,
    })
  })

  it('skips writes when mapped fields are unchanged', async () => {
    const user = { id: 'user-1', email: 'same@example.com' } as never
    const payload = { update: vi.fn() } as unknown as Payload

    await expect(
      synchronizeUser(payload, {
        authCollection: 'users',
        claims: { email: 'same@example.com', sub: 'supabase-user-1' },
        user,
      }),
    ).resolves.toBe(user)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('does not synchronize protected identity or password fields', async () => {
    const user = { id: 'user-1', supabaseUserId: 'trusted' } as never
    const payload = { update: vi.fn() } as unknown as Payload

    await synchronizeUser(payload, {
      authCollection: 'users',
      claims: { sub: 'trusted' },
      mapClaims: () => ({
        id: 'other',
        password: 'unsafe',
        supabaseUserId: 'other-subject',
      }),
      user,
    })

    expect(payload.update).not.toHaveBeenCalled()
  })
})
