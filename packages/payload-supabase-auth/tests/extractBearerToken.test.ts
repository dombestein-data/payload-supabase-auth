import { describe, expect, it } from 'vitest'

import { extractBearerToken } from '../src/index.js'

describe('extractBearerToken', () => {
  it('extracts a bearer token case-insensitively', () => {
    const headers = new Headers({ authorization: 'bearer valid.jwt.token' })

    expect(extractBearerToken(headers)).toBe('valid.jwt.token')
  })

  it('returns null when the authorization header is missing', () => {
    expect(extractBearerToken(new Headers())).toBeNull()
  })

  it.each([
    'Basic credentials',
    'Bearer',
    'Bearer token with-spaces',
    'token-without-scheme',
  ])('returns null for malformed authorization value %j', (authorization) => {
    const headers = new Headers({ authorization })

    expect(extractBearerToken(headers)).toBeNull()
  })
})
