import type { SupabaseJwtClaims } from './claims.js'
import type { SupabaseTokenVerifier } from './verifyToken.js'

export type SupabaseMfaPolicy = 'disabled' | 'if-enrolled' | 'required'

export type SupabaseMfaFactor = {
  factor_type?: string
  id?: string
  status?: string
}

export type CreateSupabaseMfaVerifierOptions = {
  fetch?: typeof globalThis.fetch
  policy?: SupabaseMfaPolicy
  publishableKey?: string
  supabaseUrl?: string
  verifyToken: SupabaseTokenVerifier
}

const hasVerifiedFactor = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false

  const factors = (value as { factors?: unknown }).factors

  return (
    Array.isArray(factors) &&
    factors.some(
      (factor): factor is SupabaseMfaFactor =>
        Boolean(factor) &&
        typeof factor === 'object' &&
        (factor as SupabaseMfaFactor).status === 'verified',
    )
  )
}

/**
 * Adds Supabase MFA assurance checks to a verified access-token flow.
 *
 * `if-enrolled` queries Supabase for the current user's verified factors and
 * requires an AAL2 token only when at least one factor is enrolled. The lookup
 * fails closed so an unavailable Auth service cannot silently bypass MFA.
 */
export const createSupabaseMfaVerifier = (
  options: CreateSupabaseMfaVerifierOptions,
): SupabaseTokenVerifier => {
  const policy = options.policy ?? 'disabled'

  if (policy === 'disabled') return options.verifyToken

  if (policy === 'if-enrolled' && (!options.supabaseUrl || !options.publishableKey)) {
    return async () => {
      throw new Error(
        'Supabase MFA policy "if-enrolled" requires both "supabaseUrl" and a browser-safe "publishableKey"',
      )
    }
  }

  return async (token: string): Promise<SupabaseJwtClaims> => {
    const claims = await options.verifyToken(token)

    if (claims.aal === 'aal2') return claims

    if (policy === 'required') {
      throw new Error('Supabase MFA verification is required')
    }

    const fetchImplementation = options.fetch ?? globalThis.fetch
    const userUrl = new URL('/auth/v1/user', options.supabaseUrl)
    const response = await fetchImplementation(userUrl, {
      headers: {
        apikey: options.publishableKey!,
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Unable to determine Supabase MFA enrollment')
    }

    if (hasVerifiedFactor(await response.json())) {
      throw new Error('Supabase MFA verification is required')
    }

    return claims
  }
}
