import type { AuthCollectionSlug, AuthStrategy } from 'payload'

import { extractBearerToken } from '../token/extractBearerToken.js'
import type { SupabaseTokenVerifier } from '../token/verifyToken.js'
import type { ClaimMapper } from '../users/claimMapping.js'
import { provisionUser, type ProvisionUserOptions } from '../users/provisionUser.js'
import { resolveLinkedUser, type ResolveLinkedUserOptions } from '../users/resolveLinkedUser.js'
import { synchronizeUser, type SynchronizeUserOptions } from '../users/synchronizeUser.js'

export type CreateSupabaseStrategyOptions = {
  /** Payload collection containing the Supabase-linked users. */
  authCollection: string

  /** Verifies the signature and registered claims of a Supabase access token. */
  verifyToken: SupabaseTokenVerifier

  /** Strategy name exposed on the authenticated user. */
  name?: string

  /** Field containing the Supabase JWT subject. */
  userIdField?: string

  /** Override the built-in linked-user lookup, primarily for custom stores. */
  resolveUser?: typeof resolveLinkedUser

  provisionUsers?: boolean
  synchronizeUsers?: boolean
  mapClaims?: ClaimMapper
  provisionUser?: (
    payload: Parameters<typeof provisionUser>[0],
    options: ProvisionUserOptions,
  ) => ReturnType<typeof provisionUser>
  synchronizeUser?: (
    payload: Parameters<typeof synchronizeUser>[0],
    options: SynchronizeUserOptions,
  ) => ReturnType<typeof synchronizeUser>
}

export const createSupabaseStrategy = (options: CreateSupabaseStrategyOptions): AuthStrategy => {
  const name = options.name ?? 'supabase-bearer'
  const resolveUser = options.resolveUser ?? resolveLinkedUser
  const createUser = options.provisionUser ?? provisionUser
  const updateUser = options.synchronizeUser ?? synchronizeUser

  return {
    name,
    authenticate: async ({ headers, isGraphQL = false, payload, strategyName = name }) => {
      const token = extractBearerToken(headers)

      if (!token) {
        return { user: null }
      }

      try {
        const claims = await options.verifyToken(token)
        const resolverOptions: ResolveLinkedUserOptions = {
          authCollection: options.authCollection,
          depth: isGraphQL
            ? 0
            : (payload.collections[options.authCollection as AuthCollectionSlug]?.config.auth
                .depth ?? 0),
          subject: claims.sub,
          userIdField: options.userIdField,
        }
        let user = await resolveUser(payload, resolverOptions)

        if (!user && options.provisionUsers) {
          try {
            user = await createUser(payload, {
              authCollection: options.authCollection,
              claims,
              mapClaims: options.mapClaims,
              userIdField: options.userIdField,
            })
          } catch (provisioningError) {
            // A concurrent request may have created the same unique subject
            // after our initial lookup. Resolve once more before failing.
            user = await resolveUser(payload, resolverOptions)
            if (!user) {
              throw provisioningError
            }
          }
        }

        if (!user) {
          return { user: null }
        }

        if (options.synchronizeUsers) {
          user = await updateUser(payload, {
            authCollection: options.authCollection,
            claims,
            mapClaims: options.mapClaims,
            user,
            userIdField: options.userIdField,
          })
        }

        Object.assign(user, { collection: options.authCollection })
        user._strategy = strategyName

        return { user }
      } catch {
        // Authentication strategies fail closed so another configured strategy
        // may still attempt to authenticate the request.
        return { user: null }
      }
    },
  }
}
