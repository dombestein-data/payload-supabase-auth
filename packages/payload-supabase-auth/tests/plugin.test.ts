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
      disableLocalStrategy: {
        enableFields: true,
        optionalPassword: true,
      },
      strategies: [
        {
          name: 'supabase-session',
          authenticate: expect.any(Function),
        },
        {
          name: 'supabase-bearer',
          authenticate: expect.any(Function),
        },
      ],
    })
    expect(config.collections?.[0]?.auth).toBe(true)
  })

  it('can explicitly preserve Payload local password authentication', async () => {
    const transformed = await supabaseAuthPlugin({
      authCollection: 'users',
      disablePayloadLocalAuth: false,
      verifyToken,
    })(createConfig())

    expect(transformed.collections?.[0]?.auth).not.toHaveProperty('disableLocalStrategy')
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
      expect.objectContaining({ name: 'supabase-session' }),
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
    expect(transformed.endpoints).toHaveLength(0)
  })

  it('adds both exchange endpoints while preserving existing endpoints', async () => {
    const existingEndpoint = {
      handler: vi.fn(),
      method: 'get' as const,
      path: '/existing',
    }
    const transformed = await supabaseAuthPlugin({
      authCollection: 'users',
      exchangeEndpointPath: '/auth/exchange',
      verifyToken,
    })({
      ...createConfig(),
      endpoints: [existingEndpoint],
    })

    expect(transformed.endpoints).toEqual([
      existingEndpoint,
      expect.objectContaining({
        method: 'post',
        path: '/supabase/exchange-code',
      }),
      expect.objectContaining({
        method: 'post',
        path: '/auth/exchange',
      }),
    ])
  })

  it('rejects an existing exchange endpoint path', () => {
    const plugin = supabaseAuthPlugin({
      authCollection: 'users',
      verifyToken,
    })

    expect(() =>
      plugin({
        ...createConfig(),
        endpoints: [
          {
            handler: vi.fn(),
            method: 'post',
            path: '/supabase/exchange',
          },
        ],
      }),
    ).toThrow('auth endpoint')
  })

  it('can omit the exchange-code issuer endpoint independently', async () => {
    const transformed = await supabaseAuthPlugin({
      authCollection: 'users',
      enableExchangeCodeEndpoint: false,
      verifyToken,
    })(createConfig())

    expect(transformed.endpoints).toEqual([expect.objectContaining({ path: '/supabase/exchange' })])
  })

  it('adds an opt-in Supabase panel to the admin login page', async () => {
    const existingComponent = { path: '/existing-component' }
    const transformed = await supabaseAuthPlugin({
      admin: {
        description: 'Company account',
        publishableKey: 'public-test-key',
      },
      authCollection: 'users',
      exchangeCodeEndpointPath: '/auth/code',
      exchangeEndpointPath: '/auth/session',
      supabaseUrl: 'https://project.supabase.co',
    })({
      ...createConfig(),
      admin: { components: { beforeLogin: [existingComponent] } },
      routes: { admin: '/cms', api: '/service' },
    })

    expect(transformed.admin?.components?.beforeLogin).toEqual([
      existingComponent,
      {
        clientProps: {
          adminRoute: '/cms',
          description: 'Company account',
          exchangeCodeEndpoint: '/service/auth/code',
          exchangeEndpoint: '/service/auth/session',
          heading: undefined,
          mfaPolicy: 'if-enrolled',
          publishableKey: 'public-test-key',
          supabaseUrl: 'https://project.supabase.co',
        },
        exportName: 'SupabaseLogin',
        path: '@dombestein-data/payload-supabase-auth/client',
      },
    ])
  })

  it('warns and leaves a visual warning configured when admin settings are incomplete', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const transformed = await supabaseAuthPlugin({
      admin: {},
      authCollection: 'users',
      verifyToken,
    })(createConfig())

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('not fully configured'))
    expect(transformed.admin?.components?.beforeLogin?.[0]).toMatchObject({
      clientProps: {
        publishableKey: undefined,
        supabaseUrl: undefined,
      },
    })
    consoleError.mockRestore()
  })

  it('does not add the admin panel when the admin option is disabled', async () => {
    const transformed = await supabaseAuthPlugin({
      admin: { enabled: false },
      authCollection: 'users',
      verifyToken,
    })(createConfig())

    expect(transformed.admin?.components?.beforeLogin).toBeUndefined()
  })
})
