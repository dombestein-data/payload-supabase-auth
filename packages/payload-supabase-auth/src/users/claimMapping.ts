import type { SupabaseJwtClaims } from '../token/claims.js'

export type ClaimMapper = (
  claims: SupabaseJwtClaims,
) => Promise<Record<string, unknown>> | Record<string, unknown>

export const mapDefaultClaims = (
  claims: SupabaseJwtClaims,
): Record<string, unknown> => {
  return typeof claims.email === 'string' && claims.email.length > 0
    ? { email: claims.email }
    : {}
}
