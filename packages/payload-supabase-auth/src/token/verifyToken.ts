import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

import type { SupabaseJwtClaims } from './claims.js'

const supportedAlgorithms = ['ES256', 'RS256'] as const

export type SupabaseTokenVerifierOptions = {
  /** Base URL of the Supabase project, for example https://project-ref.supabase.co. */
  supabaseUrl: string

  /** Defaults to `<supabaseUrl>/auth/v1`. */
  issuer?: string

  /** Defaults to `authenticated`. */
  audience?: string | string[]

  /** Primarily intended for tests or custom JWKS transports. */
  jwks?: JWTVerifyGetKey
}

export type SupabaseTokenVerifier = (token: string) => Promise<SupabaseJwtClaims>

const withoutTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

/** Creates a reusable verifier backed by the Supabase project's remote JWKS. */
export const createSupabaseTokenVerifier = (
  options: SupabaseTokenVerifierOptions,
): SupabaseTokenVerifier => {
  const supabaseUrl = withoutTrailingSlash(options.supabaseUrl)
  const issuer = options.issuer ?? `${supabaseUrl}/auth/v1`
  const audience = options.audience ?? 'authenticated'
  const jwks =
    options.jwks ??
    createRemoteJWKSet(new URL(`${withoutTrailingSlash(issuer)}/.well-known/jwks.json`))

  return async (token: string): Promise<SupabaseJwtClaims> => {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: [...supportedAlgorithms],
      issuer,
      audience,
    })

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new TypeError('Supabase access token is missing a valid subject claim')
    }

    return payload as SupabaseJwtClaims
  }
}
