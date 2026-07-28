import type { AuthCollectionSlug, Payload } from 'payload'

import type { SupabaseJwtClaims } from '../token/claims.js'
import {
  mapDefaultClaims,
  type ClaimMapper,
} from './claimMapping.js'
import type { LinkedUser } from './resolveLinkedUser.js'

export type SynchronizeUserOptions = {
  authCollection: string
  claims: SupabaseJwtClaims
  mapClaims?: ClaimMapper
  user: LinkedUser
  userIdField?: string
}

/** Updates mapped Payload fields when their verified claim values changed. */
export const synchronizeUser = async (
  payload: Payload,
  options: SynchronizeUserOptions,
): Promise<LinkedUser> => {
  const mappedData = await (options.mapClaims ?? mapDefaultClaims)(options.claims)
  const currentUser = options.user as unknown as Record<string, unknown>
  const protectedFields = new Set([
    'id',
    'password',
    'collection',
    options.userIdField ?? 'supabaseUserId',
  ])
  const changes = Object.fromEntries(
    Object.entries(mappedData).filter(
      ([key, value]) =>
        !protectedFields.has(key) && !Object.is(currentUser[key], value),
    ),
  )

  if (Object.keys(changes).length === 0) {
    return options.user
  }

  return payload.update({
    id: options.user.id,
    collection: options.authCollection as AuthCollectionSlug,
    data: changes as never,
    depth: 0,
    overrideAccess: true,
  }) as Promise<LinkedUser>
}
