import type { Config, Plugin } from 'payload'

import {
  createExchangeCodeCollection,
  defaultExchangeCodeCollection,
} from './exchange/exchangeCodeCollection.js'
import { createSupabaseStrategy } from './strategy/createSupabaseStrategy.js'
import { createSupabaseTokenVerifier } from './token/verifyToken.js'
import type { PayloadSupabaseAuthOptions } from './types.js'

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

    if (!options.verifyToken && !options.supabaseUrl) {
      throw new Error('supabaseAuthPlugin requires either "supabaseUrl" or "verifyToken"')
    }

    const verifyToken =
      options.verifyToken ??
      createSupabaseTokenVerifier({
        audience: options.audience,
        issuer: options.issuer,
        supabaseUrl: options.supabaseUrl!,
      })
    const strategy = createSupabaseStrategy({
      authCollection: options.authCollection,
      mapClaims: options.mapClaims,
      provisionUsers: options.provisionUsers,
      synchronizeUsers: options.synchronizeUsers,
      userIdField: options.userIdField,
      verifyToken,
    })
    const auth = collection.auth === true ? {} : collection.auth
    const updatedCollection = {
      ...collection,
      auth: {
        ...auth,
        strategies: [...(auth.strategies ?? []), strategy],
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

    return {
      ...incomingConfig,
      collections,
    }
  }
}
