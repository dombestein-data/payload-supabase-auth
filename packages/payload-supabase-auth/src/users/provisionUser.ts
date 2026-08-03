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
  /** Generate a private local password. Disable for Supabase-authoritative users. */
  generatePayloadPassword?: boolean
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

  const password =
    options.generatePayloadPassword === false
      ? {}
      : { password: randomBytes(32).toString('base64url') }

  return payload.create({
    collection: options.authCollection as AuthCollectionSlug,
    data: {
      ...mappedData,
      email,
      ...password,
      [options.userIdField ?? 'supabaseUserId']: options.claims.sub,
    } as never,
    depth: 0,
    overrideAccess: true,
  }) as Promise<LinkedUser>
}
