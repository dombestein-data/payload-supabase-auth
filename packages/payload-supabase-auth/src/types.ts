import type { SupabaseTokenVerifier } from './token/verifyToken.js'
import type { ClaimMapper } from './users/claimMapping.js'
import type { SupabaseMfaPolicy } from './token/verifyMfa.js'

export type SupabaseAdminOptions = {
  /** Set false to omit the Supabase panel from Payload's admin login page. */
  enabled?: boolean

  /** Browser-safe Supabase publishable or legacy anon key. Never use a service-role key. */
  publishableKey?: string

  /** Optional browser-facing project URL. Defaults to the top-level `supabaseUrl`. */
  supabaseUrl?: string

  /** Heading shown above the Supabase email/password form. */
  heading?: string

  /** Supporting text shown below the heading. */
  description?: string
}

export type SupabaseMfaOptions = {
  /** `if-enrolled` requires AAL2 only for users with a verified Supabase factor. */
  policy?: SupabaseMfaPolicy

  /** Browser-safe key used to query the authenticated user's enrolled factors. */
  publishableKey?: string
}

export type PayloadSupabaseAuthOptions = {
  /** The Payload auth collection that will contain Supabase-linked users. */
  authCollection: string

  /** Base URL of the Supabase project. Required unless `verifyToken` is supplied. */
  supabaseUrl?: string

  /** Opt-in Payload admin login UI backed by Supabase password authentication. */
  admin?: SupabaseAdminOptions

  /** Server-side MFA assurance policy. Defaults to `if-enrolled` when admin UI is enabled. */
  mfa?: SupabaseMfaOptions

  /** Disable Payload password login and recovery. Defaults to true. */
  disablePayloadLocalAuth?: boolean

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

  /** Internal collection slug used for shared one-time exchange-code storage. */
  exchangeCodeCollection?: string

  /** Set false to omit the internal exchange-code collection. */
  enableExchangeCodes?: boolean

  /** Set false to omit the POST session-exchange endpoint. */
  enableExchangeEndpoint?: boolean

  /** Set false to omit the authenticated POST exchange-code endpoint. */
  enableExchangeCodeEndpoint?: boolean

  /** Authenticated endpoint that issues one-time exchange codes. */
  exchangeCodeEndpointPath?: string

  /** Lifetime of newly issued exchange codes in milliseconds. */
  exchangeCodeTTL?: number

  /** Endpoint path relative to Payload's API route. */
  exchangeEndpointPath?: string

  /** Allowed origins for both exchange endpoints. Defaults to the request origin. */
  exchangeAllowedOrigins?: string[]

  /** Set to false to leave the incoming Payload configuration unchanged. */
  enabled?: boolean
}
