import { JWTAuthentication, type Config, type Plugin } from 'payload'

import {
  createExchangeCodeCollection,
  defaultExchangeCodeCollection,
} from './exchange/exchangeCodeCollection.js'
import { createExchangeCodeEndpoint } from './endpoints/exchangeCode.js'
import { createExchangeEndpoint } from './endpoints/exchange.js'
import { createSupabaseStrategy } from './strategy/createSupabaseStrategy.js'
import { createSupabaseTokenVerifier } from './token/verifyToken.js'
import { createSupabaseMfaVerifier } from './token/verifyMfa.js'
import type { PayloadSupabaseAuthOptions } from './types.js'

const adminComponentPath = '@dombestein-data/payload-supabase-auth/client'

const joinRoute = (base: string, path: string): string => {
  const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}` || '/'
}

/**
 * Adds Supabase authentication support to Payload.
 */
export const supabaseAuthPlugin = (options: PayloadSupabaseAuthOptions): Plugin => {
  return (incomingConfig: Config): Config => {
    if (options.enabled === false) {
      return incomingConfig
    }

    const collectionIndex = incomingConfig.collections?.findIndex(
      ({ slug }) => slug === options.authCollection,
    )

    if (collectionIndex === undefined || collectionIndex < 0) {
      throw new Error(`Supabase auth collection "${options.authCollection}" was not found`)
    }

    const collection = incomingConfig.collections![collectionIndex]!

    if (!collection.auth) {
      throw new Error(`Supabase auth collection "${options.authCollection}" must have auth enabled`)
    }

    const adminEnabled = Boolean(options.admin && options.admin.enabled !== false)

    if (!options.verifyToken && !options.supabaseUrl && !adminEnabled) {
      throw new Error('supabaseAuthPlugin requires either "supabaseUrl" or "verifyToken"')
    }

    const baseVerifyToken =
      options.verifyToken ??
      (options.supabaseUrl
        ? createSupabaseTokenVerifier({
            audience: options.audience,
            issuer: options.issuer,
            supabaseUrl: options.supabaseUrl,
          })
        : async () => {
            throw new Error('Supabase token verification is not configured')
          })
    const mfaPolicy = options.mfa?.policy ?? (adminEnabled ? 'if-enrolled' : 'disabled')
    const mfaPublishableKey =
      options.mfa?.publishableKey?.trim() ?? options.admin?.publishableKey?.trim()
    const mfaSupabaseUrl = options.supabaseUrl ?? options.admin?.supabaseUrl
    const verifyToken = createSupabaseMfaVerifier({
      policy: mfaPolicy,
      publishableKey: mfaPublishableKey,
      supabaseUrl: mfaSupabaseUrl,
      verifyToken: baseVerifyToken,
    })
    const strategy = createSupabaseStrategy({
      authCollection: options.authCollection,
      mapClaims: options.mapClaims,
      generatePayloadPassword: options.disablePayloadLocalAuth === false,
      provisionUsers: options.provisionUsers,
      synchronizeUsers: options.synchronizeUsers,
      userIdField: options.userIdField,
      verifyToken,
    })
    const auth = collection.auth === true ? {} : collection.auth
    const disablePayloadLocalAuth = options.disablePayloadLocalAuth !== false
    const sessionStrategy = {
      authenticate: JWTAuthentication,
      name: 'supabase-session',
    }
    const updatedCollection = {
      ...collection,
      auth: {
        ...auth,
        ...(disablePayloadLocalAuth
          ? {
              disableLocalStrategy: {
                enableFields: true as const,
                optionalPassword: true as const,
              },
            }
          : {}),
        strategies: [
          ...(auth.strategies ?? []),
          ...(disablePayloadLocalAuth ? [sessionStrategy] : []),
          strategy,
        ],
      },
    }
    const collections = [...incomingConfig.collections!]
    collections[collectionIndex] = updatedCollection

    if (options.enableExchangeCodes !== false) {
      const exchangeCodeCollection = options.exchangeCodeCollection ?? defaultExchangeCodeCollection
      if (collections.some(({ slug }) => slug === exchangeCodeCollection)) {
        throw new Error(
          `Supabase exchange-code collection "${exchangeCodeCollection}" already exists`,
        )
      }
      collections.push(createExchangeCodeCollection(exchangeCodeCollection))
    }

    const endpoints = [...(incomingConfig.endpoints ?? [])]
    const assertEndpointAvailable = (path: string) => {
      if (
        endpoints.some(
          ({ method, path: existingPath }) => method === 'post' && existingPath === path,
        )
      ) {
        throw new Error(`Supabase auth endpoint "${path}" already exists`)
      }
    }

    if (options.enableExchangeCodes !== false && options.enableExchangeCodeEndpoint !== false) {
      const exchangeCodeEndpointPath = options.exchangeCodeEndpointPath ?? '/supabase/exchange-code'
      assertEndpointAvailable(exchangeCodeEndpointPath)
      endpoints.push(
        createExchangeCodeEndpoint({
          allowedOrigins: options.exchangeAllowedOrigins,
          authCollection: options.authCollection,
          exchangeCodeCollection: options.exchangeCodeCollection ?? defaultExchangeCodeCollection,
          path: exchangeCodeEndpointPath,
          ttlMs: options.exchangeCodeTTL,
        }),
      )
    }

    if (options.enableExchangeCodes !== false && options.enableExchangeEndpoint !== false) {
      const exchangeEndpointPath = options.exchangeEndpointPath ?? '/supabase/exchange'
      assertEndpointAvailable(exchangeEndpointPath)
      endpoints.push(
        createExchangeEndpoint({
          allowedOrigins: options.exchangeAllowedOrigins,
          authCollection: options.authCollection,
          exchangeCodeCollection: options.exchangeCodeCollection ?? defaultExchangeCodeCollection,
          path: exchangeEndpointPath,
        }),
      )
    }

    let admin = incomingConfig.admin

    if (options.admin && options.admin.enabled !== false) {
      const publishableKey = options.admin.publishableKey?.trim()
      const adminSupabaseUrl = (options.admin.supabaseUrl ?? options.supabaseUrl)?.trim()
      const exchangeEndpointsEnabled =
        options.enableExchangeCodes !== false &&
        options.enableExchangeCodeEndpoint !== false &&
        options.enableExchangeEndpoint !== false

      if (!publishableKey || !adminSupabaseUrl || !exchangeEndpointsEnabled) {
        const missing = [
          !adminSupabaseUrl && 'a Supabase URL',
          !publishableKey && 'a browser-safe Supabase publishable key',
          !exchangeEndpointsEnabled && 'both exchange endpoints',
        ]
          .filter(Boolean)
          .join(', ')

        console.error(
          `[payload-supabase-auth] Admin sign-in is not fully configured: missing ${missing}. ` +
            'The login page will show a configuration warning.',
        )
      }

      const apiRoute = incomingConfig.routes?.api ?? '/api'
      const adminRoute = incomingConfig.routes?.admin ?? '/admin'
      const beforeLogin = incomingConfig.admin?.components?.beforeLogin ?? []

      admin = {
        ...incomingConfig.admin,
        components: {
          ...incomingConfig.admin?.components,
          beforeLogin: [
            ...beforeLogin,
            {
              clientProps: {
                adminRoute,
                description: options.admin.description,
                exchangeCodeEndpoint: joinRoute(
                  apiRoute,
                  options.exchangeCodeEndpointPath ?? '/supabase/exchange-code',
                ),
                exchangeEndpoint: joinRoute(
                  apiRoute,
                  options.exchangeEndpointPath ?? '/supabase/exchange',
                ),
                heading: options.admin.heading,
                mfaPolicy,
                publishableKey,
                supabaseUrl: adminSupabaseUrl,
              },
              exportName: 'SupabaseLogin',
              path: adminComponentPath,
            },
          ],
        },
      }
    }

    return {
      ...incomingConfig,
      admin,
      collections,
      endpoints,
    }
  }
}
