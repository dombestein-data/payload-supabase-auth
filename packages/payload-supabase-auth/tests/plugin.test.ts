import type { Config } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { supabaseAuthPlugin } from '../src/index.js'

const createConfig = (): Config =>
  ({
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [],
      },
    ],
    secret: 'test-secret',
  }) as unknown as Config

const verifyToken = vi.fn()

describe('supabaseAuthPlugin', () => {
  it('creates a Payload config transformer', () => {
    const plugin = supabaseAuthPlugin({ authCollection: 'users', verifyToken })

    expect(plugin).toBeTypeOf('function')
  })

  it('installs the Supabase strategy when enabled by default', async () => {
    const config = createConfig()
    const plugin = supabaseAuthPlugin({ authCollection: 'users', verifyToken })
    const transformed = await plugin(config)

    expect(transformed).not.toBe(config)
    expect(transformed.collections?.[0]?.auth).toMatchObject({
      strategies: [
        {
          name: 'supabase-bearer',
          authenticate: expect.any(Function),
        },
      ],
    })
    expect(config.collections?.[0]?.auth).toBe(true)
  })

  it('preserves existing auth options and strategies', async () => {
    const existingStrategy = {
      name: 'existing',
      authenticate: vi.fn().mockReturnValue({ user: null }),
    }
    const config = {
      ...createConfig(),
      collections: [
        {
          slug: 'users',
          fields: [],
          auth: {
            tokenExpiration: 300,
            strategies: [existingStrategy],
          },
        },
      ],
    } as Config
    const plugin = supabaseAuthPlugin({
      authCollection: 'users',
      enabled: true,
      verifyToken,
    })
    const auth = (await plugin(config)).collections?.[0]?.auth

    expect(auth).toMatchObject({ tokenExpiration: 300 })
    expect(auth && auth !== true ? auth.strategies : []).toEqual([
      existingStrategy,
      expect.objectContaining({ name: 'supabase-bearer' }),
    ])
  })

  it('returns the original config when disabled', () => {
    const config = createConfig()
    const plugin = supabaseAuthPlugin({
      authCollection: 'users',
      enabled: false,
    })

    expect(plugin(config)).toBe(config)
  })

  it('rejects a missing auth collection', () => {
    const config = { ...createConfig(), collections: [] }
    const plugin = supabaseAuthPlugin({
      authCollection: 'users',
      verifyToken,
    })

    expect(() => plugin(config)).toThrow('was not found')
  })

  it('rejects a collection without auth enabled', () => {
    const config = {
      ...createConfig(),
      collections: [{ slug: 'users', fields: [] }],
    } as Config
    const plugin = supabaseAuthPlugin({
      authCollection: 'users',
      verifyToken,
    })

    expect(() => plugin(config)).toThrow('must have auth enabled')
  })

  it('requires verifier configuration when enabled', () => {
    const plugin = supabaseAuthPlugin({ authCollection: 'users' })

    expect(() => plugin(createConfig())).toThrow('requires either "supabaseUrl" or "verifyToken"')
  })

  it('adds a hidden, access-denied exchange-code collection', async () => {
    const transformed = await supabaseAuthPlugin({
      authCollection: 'users',
      verifyToken,
    })(createConfig())
    const collection = transformed.collections?.find(
      ({ slug }) => slug === 'supabase-exchange-codes',
    )

    expect(collection).toMatchObject({
      admin: { hidden: true },
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: 'digest',
          unique: true,
          index: true,
        }),
        expect.objectContaining({ name: 'expiresAt', index: true }),
      ]),
    })
    expect(collection?.access?.read?.({} as never)).toBe(false)
  })

  it('can omit the exchange-code collection', async () => {
    const transformed = await supabaseAuthPlugin({
      authCollection: 'users',
      enableExchangeCodes: false,
      verifyToken,
    })(createConfig())

    expect(transformed.collections).toHaveLength(1)
  })
})
