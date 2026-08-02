export type CreateSupabaseAdminSessionOptions = {
  email: string
  exchangeCodeEndpoint: string
  exchangeEndpoint: string
  fetch?: typeof globalThis.fetch
  password: string
  publishableKey: string
  supabaseUrl: string
}

type JsonRecord = Record<string, unknown>

const readJson = async (response: Response): Promise<JsonRecord> => {
  try {
    const value: unknown = await response.json()

    return value !== null && typeof value === 'object' ? (value as JsonRecord) : {}
  } catch {
    return {}
  }
}

/**
 * Authenticates with Supabase, then trades the bearer token for a Payload session cookie.
 */
export const createSupabaseAdminSession = async (
  options: CreateSupabaseAdminSessionOptions,
): Promise<void> => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const tokenUrl = new URL('/auth/v1/token', `${options.supabaseUrl.replace(/\/$/, '')}/`)
  tokenUrl.searchParams.set('grant_type', 'password')

  const tokenResponse = await fetchImplementation(tokenUrl, {
    body: JSON.stringify({ email: options.email, password: options.password }),
    headers: {
      apikey: options.publishableKey,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const tokenBody = await readJson(tokenResponse)
  const accessToken = tokenBody.access_token

  if (!tokenResponse.ok || typeof accessToken !== 'string' || !accessToken) {
    throw new Error('The email or password is incorrect.')
  }

  const codeResponse = await fetchImplementation(options.exchangeCodeEndpoint, {
    credentials: 'same-origin',
    headers: { Authorization: `Bearer ${accessToken}` },
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
