import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { createSupabaseTokenVerifier } from '../src/index.js'

const issuer = 'https://test-project.supabase.co/auth/v1'
const audience = 'authenticated'
const subject = '550e8400-e29b-41d4-a716-446655440000'

let privateKey: CryptoKey
let publicJwk: JWK

const createToken = async (
  claims: Record<string, unknown> = {},
  options: { audience?: string; issuer?: string; subject?: string } = {},
): Promise<string> =>
  new SignJWT({
    email: 'editor@example.com',
    role: 'authenticated',
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? audience)
    .setSubject(options.subject ?? subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

beforeAll(async () => {
  const keys = await generateKeyPair('ES256', { extractable: true })
  privateKey = keys.privateKey
  publicJwk = {
    ...(await exportJWK(keys.publicKey)),
    alg: 'ES256',
    kid: 'test-key',
    use: 'sig',
  }
})

const createVerifier = () =>
  createSupabaseTokenVerifier({
    supabaseUrl: 'https://test-project.supabase.co',
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
  })

describe('createSupabaseTokenVerifier', () => {
  it('returns verified Supabase claims for a valid access token', async () => {
    const claims = await createVerifier()(await createToken())

    expect(claims).toMatchObject({
      sub: subject,
      iss: issuer,
      aud: audience,
      email: 'editor@example.com',
      role: 'authenticated',
    })
  })

  it('rejects a token signed by an untrusted key', async () => {
    const { privateKey: untrustedKey } = await generateKeyPair('ES256')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'untrusted-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setExpirationTime('5m')
      .sign(untrustedKey)

    await expect(createVerifier()(token)).rejects.toThrow()
  })

  it('rejects a token from the wrong issuer', async () => {
    const token = await createToken({}, { issuer: 'https://attacker.example/auth/v1' })

    await expect(createVerifier()(token)).rejects.toThrow()
  })

  it('rejects a token with the wrong audience', async () => {
    const token = await createToken({}, { audience: 'anon' })

    await expect(createVerifier()(token)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setExpirationTime(0)
      .sign(privateKey)

    await expect(createVerifier()(token)).rejects.toThrow()
  })

  it('rejects a token without a subject', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(createVerifier()(token)).rejects.toThrow('missing a valid subject claim')
  })
})
