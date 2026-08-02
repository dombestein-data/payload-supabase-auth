import type { PayloadRequest } from 'payload'

/** Requires an exact trusted browser origin for cookie-related endpoints. */
export const hasAllowedOrigin = (req: PayloadRequest, allowedOrigins?: string[]): boolean => {
  const origin = req.headers.get('origin')
  if (!origin) return false
  if (allowedOrigins) return allowedOrigins.includes(origin)
  if (!req.url) return false

  try {
    return new URL(req.url).origin === origin
  } catch {
    return false
  }
}
