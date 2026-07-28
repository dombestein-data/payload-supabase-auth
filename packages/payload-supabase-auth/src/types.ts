import type { SupabaseTokenVerifier } from './token/verifyToken.js'
import type { ClaimMapper } from './users/claimMapping.js'

export type PayloadSupabaseAuthOptions = {
  /** The Payload auth collection that will contain Supabase-linked users. */
  authCollection: string

  /** Base URL of the Supabase project. Required unless `verifyToken` is supplied. */
  supabaseUrl?: string

  /** Overrides the default Supabase JWT issuer. */
  issuer?: string

  /** Overrides the default `authenticated` JWT audience. */
  audience?: string | string[]

  /** Field on the Payload user containing the Supabase JWT subject. */
  userIdField?: string

  /** Custom verifier, primarily for tests or non-standard key transports. */
  verifyToken?: SupabaseTokenVerifier

  /** Create a linked Payload user when a verified subject is not found. */
  provisionUsers?: boolean

  /** Update mapped Payload fields during successful bearer authentication. */
  synchronizeUsers?: boolean

  /** Maps verified claims to Payload fields for provisioning and synchronization. */
  mapClaims?: ClaimMapper

  /** Set to false to leave the incoming Payload configuration unchanged. */
  enabled?: boolean
}
