const bearerTokenPattern = /^Bearer\s+([^\s]+)$/i

/** Extracts a bearer token from Fetch-compatible request headers. */
export const extractBearerToken = (headers: Headers): string | null => {
  const authorization = headers.get('authorization')

  if (!authorization) {
    return null
  }

  return bearerTokenPattern.exec(authorization.trim())?.[1] ?? null
}
