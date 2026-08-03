import type { SupabaseMfaPolicy } from '../token/verifyMfa.js'

export type SupabaseAdminMfaFactor = {
  factorType: 'phone' | 'totp'
  friendlyName?: string
  id: string
  phone?: string
}

export type SupabasePasswordSignIn = {
  accessToken: string
  factors: SupabaseAdminMfaFactor[]
  requiresMfa: boolean
}

type FetchOptions = {
  fetch?: typeof globalThis.fetch
  publishableKey: string
  supabaseUrl: string
}

export type SignInWithSupabasePasswordOptions = FetchOptions & {
  email: string
  mfaPolicy?: SupabaseMfaPolicy
  password: string
}

export type ChallengeSupabaseMfaOptions = FetchOptions & {
  accessToken: string
  factor: SupabaseAdminMfaFactor
}

export type VerifySupabaseMfaOptions = ChallengeSupabaseMfaOptions & {
  challengeId: string
  code: string
}

export type ExchangeSupabaseAdminSessionOptions = {
  accessToken: string
  exchangeCodeEndpoint: string
  exchangeEndpoint: string
  fetch?: typeof globalThis.fetch
}

export type CreateSupabaseAdminSessionOptions = SignInWithSupabasePasswordOptions &
  Omit<ExchangeSupabaseAdminSessionOptions, 'accessToken'>

type JsonRecord = Record<string, unknown>

const readJson = async (response: Response): Promise<JsonRecord> => {
  try {
    const value: unknown = await response.json()

    return value !== null && typeof value === 'object' ? (value as JsonRecord) : {}
  } catch {
    return {}
  }
}

const getAuthHeaders = (publishableKey: string, accessToken?: string) => ({
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  apikey: publishableKey,
  'Content-Type': 'application/json',
})

const getAal = (accessToken: string): string | undefined => {
  try {
    const encodedPayload = accessToken.split('.')[1]
    if (!encodedPayload) return undefined

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(globalThis.atob(normalized)) as { aal?: unknown }

    return typeof payload.aal === 'string' ? payload.aal : undefined
  } catch {
    return undefined
  }
}

const getVerifiedFactors = (body: JsonRecord): SupabaseAdminMfaFactor[] => {
  if (!Array.isArray(body.factors)) return []

  return body.factors.flatMap((value) => {
    if (!value || typeof value !== 'object') return []

    const factor = value as Record<string, unknown>
    if (
      factor.status !== 'verified' ||
      typeof factor.id !== 'string' ||
      (factor.factor_type !== 'totp' && factor.factor_type !== 'phone')
    ) {
      return []
    }

    return [
      {
        factorType: factor.factor_type,
        friendlyName: typeof factor.friendly_name === 'string' ? factor.friendly_name : undefined,
        id: factor.id,
        phone: typeof factor.phone === 'string' ? factor.phone : undefined,
      },
    ]
  })
}

export const signInWithSupabasePassword = async (
  options: SignInWithSupabasePasswordOptions,
): Promise<SupabasePasswordSignIn> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const tokenUrl = new URL('/auth/v1/token', `${options.supabaseUrl.replace(/\/$/, '')}/`)
  tokenUrl.searchParams.set('grant_type', 'password')

  const tokenResponse = await fetchImplementation(tokenUrl, {
    body: JSON.stringify({ email: options.email, password: options.password }),
    headers: getAuthHeaders(options.publishableKey),
    method: 'POST',
  })
  const tokenBody = await readJson(tokenResponse)
  const accessToken = tokenBody.access_token

  if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
    throw new Error('The email or password is incorrect.')
  }

  const policy = options.mfaPolicy ?? 'if-enrolled'
  if (policy === 'disabled') return { accessToken, factors: [], requiresMfa: false }

  const userResponse = await fetchImplementation(
    new URL('/auth/v1/user', `${options.supabaseUrl.replace(/\/$/, '')}/`),
    {
      headers: getAuthHeaders(options.publishableKey, accessToken),
      method: 'GET',
    },
  )

  if (!userResponse.ok) {
    throw new Error('Supabase signed in, but MFA enrollment could not be checked.')
  }

  const factors = getVerifiedFactors(await readJson(userResponse))
  const alreadyVerified = getAal(accessToken) === 'aal2'

  if (policy === 'required' && factors.length === 0) {
    throw new Error(
      'Multi-factor authentication is required. Enroll through your account system or contact your system administrator.',
    )
  }

  return {
    accessToken,
    factors,
    requiresMfa: !alreadyVerified && factors.length > 0,
  }
}

export const challengeSupabaseMfa = async (
  options: ChallengeSupabaseMfaOptions,
): Promise<string> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const response = await fetchImplementation(
    new URL(
      `/auth/v1/factors/${encodeURIComponent(options.factor.id)}/challenge`,
      `${options.supabaseUrl.replace(/\/$/, '')}/`,
    ),
    {
      body: JSON.stringify(options.factor.factorType === 'phone' ? { channel: 'sms' } : {}),
      headers: getAuthHeaders(options.publishableKey, options.accessToken),
      method: 'POST',
    },
  )
  const body = await readJson(response)

  if (!response.ok || typeof body.id !== 'string') {
    throw new Error('Supabase could not start the MFA challenge. Please try again.')
  }

  return body.id
}

export const verifySupabaseMfa = async (options: VerifySupabaseMfaOptions): Promise<string> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const response = await fetchImplementation(
    new URL(
      `/auth/v1/factors/${encodeURIComponent(options.factor.id)}/verify`,
      `${options.supabaseUrl.replace(/\/$/, '')}/`,
    ),
    {
      body: JSON.stringify({ challenge_id: options.challengeId, code: options.code }),
      headers: getAuthHeaders(options.publishableKey, options.accessToken),
      method: 'POST',
    },
  )
  const body = await readJson(response)

  if (!response.ok || typeof body.access_token !== 'string') {
    throw new Error('The verification code is invalid or expired.')
  }

  return body.access_token
}

export const exchangeSupabaseAdminSession = async (
  options: ExchangeSupabaseAdminSessionOptions,
): Promise<void> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const codeResponse = await fetchImplementation(options.exchangeCodeEndpoint, {
    credentials: 'same-origin',
    headers: { Authorization: `Bearer ${options.accessToken}` },
    method: 'POST',
  })
  const codeBody = await readJson(codeResponse)
  const code = codeBody.code

  if (!codeResponse.ok || typeof code !== 'string' || !code) {
    throw new Error('Supabase signed in, but Payload could not start a session.')
  }

  const exchangeResponse = await fetchImplementation(options.exchangeEndpoint, {
    body: JSON.stringify({ code }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!exchangeResponse.ok) {
    throw new Error('Payload could not complete the session. Please try again.')
  }
}

/** Authenticates and creates a Payload session when no MFA challenge is pending. */
export const createSupabaseAdminSession = async (
  options: CreateSupabaseAdminSessionOptions,
): Promise<void> => {
  const signIn = await signInWithSupabasePassword(options)

  if (signIn.requiresMfa) {
    throw new Error('Multi-factor authentication is required to complete sign-in.')
  }

  await exchangeSupabaseAdminSession({ ...options, accessToken: signIn.accessToken })
}
