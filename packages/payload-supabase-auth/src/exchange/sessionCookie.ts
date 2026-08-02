export type SessionCookieOptions = {
  cookiePrefix: string
  domain?: string
  expires: Date
  sameSite?: 'Lax' | 'None' | 'Strict' | boolean
  secure?: boolean
  token: string
}

/** Serializes a Payload-compatible HttpOnly authentication cookie. */
export const createPayloadSessionCookie = (options: SessionCookieOptions): string => {
  const parts = [
    `${options.cookiePrefix}-token=${encodeURIComponent(options.token)}`,
    'Path=/',
    `Expires=${options.expires.toUTCString()}`,
    'HttpOnly',
  ]

  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.secure) parts.push('Secure')

  const sameSite =
    typeof options.sameSite === 'string'
      ? options.sameSite
      : options.sameSite
        ? 'Strict'
        : undefined
  if (sameSite) parts.push(`SameSite=${sameSite}`)

  return parts.join('; ')
}
