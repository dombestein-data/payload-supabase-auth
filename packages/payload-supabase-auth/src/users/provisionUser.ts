import { randomBytes } from 'node:crypto'

import type { AuthCollectionSlug, Payload } from 'payload'

import type { SupabaseJwtClaims } from '../token/claims.js'
import { mapDefaultClaims, type ClaimMapper } from './claimMapping.js'
import type { LinkedUser } from './resolveLinkedUser.js'

export type ProvisionUserOptions = {
  authCollection: string
  claims: SupabaseJwtClaims
  mapClaims?: ClaimMapper
  userIdField?: string
}

/** Creates a Payload user linked to a verified Supabase identity. */
export const provisionUser = async (
  payload: Payload,
  options: ProvisionUserOptions,
): Promise<LinkedUser> => {
  const mappedData = await (options.mapClaims ?? mapDefaultClaims)(options.claims)
  const email = mappedData.email ?? options.claims.email

  if (typeof email !== 'string' || email.length === 0) {
    throw new TypeError('Cannot provision a Payload user without an email claim')
  }

  return payload.create({
    collection: options.authCollection as AuthCollectionSlug,
    data: {
      ...mappedData,
      email,
      // Payload local auth requires a password. This random value is never
      // returned and cannot be used as a shared or predictable credential.
      password: randomBytes(32).toString('base64url'),
      [options.userIdField ?? 'supabaseUserId']: options.claims.sub,
    } as never,
    depth: 0,
    overrideAccess: true,
  }) as Promise<LinkedUser>
}
