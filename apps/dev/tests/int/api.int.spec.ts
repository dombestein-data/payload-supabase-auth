import { getPayload, handleEndpoints, Payload, type SanitizedConfig } from 'payload'
import config from '@/payload.config'
import {
  consumeExchangeCode,
  createExchangeCode,
  createPayloadExchangeCodeStore,
} from '@dombestein-data/payload-supabase-auth'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let accessToken: string
let supabaseUserId: string
let testEmail: string
let payloadConfig: SanitizedConfig

const authenticate = (token = accessToken) =>
  payload.auth({
    headers: new Headers({
      authorization: `Bearer ${token}`,
    }),
  })

const deleteLinkedUser = async () => {
  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: {
      supabaseUserId: {
        equals: supabaseUserId,
      },
    },
  })
}

describe('API', () => {
  beforeAll(async () => {
    payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
    testEmail = process.env.SUPABASE_TEST_EMAIL ?? ''
    const password = process.env.SUPABASE_TEST_PASSWORD

    if (!supabaseUrl || !publishableKey || !testEmail || !password) {
      throw new Error('Live Supabase integration environment is incomplete')
    }

    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`,
      {
        body: JSON.stringify({ email: testEmail, password }),
        headers: {
          apikey: publishableKey,
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    )

    if (!response.ok) {
      throw new Error(`Supabase test login failed with status ${response.status}`)
    }

    const session = (await response.json()) as {
      access_token?: string
      user?: { id?: string }
    }
    if (!session.access_token || !session.user?.id) {
      throw new Error('Supabase test login returned an incomplete session')
    }

    accessToken = session.access_token
    supabaseUserId = session.user.id
    await deleteLinkedUser()
  })

  afterAll(async () => {
    if (payload && supabaseUserId) {
      await deleteLinkedUser()
      await payload.delete({
        collection: 'supabase-exchange-codes' as never,
        overrideAccess: true,
        where: {},
      })
      await payload.destroy()
    }
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
  })

  it('does not provision for a tampered token', async () => {
    const [header, body, signature] = accessToken.split('.')
    const tamperedToken = `${header}.${body}.${signature}tampered`

    await expect(authenticate(tamperedToken)).resolves.toMatchObject({
      user: null,
    })

    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { supabaseUserId: { equals: supabaseUserId } },
    })
    expect(users.totalDocs).toBe(0)
  })

  it('provisions once and resolves the same linked user thereafter', async () => {
    const first = await authenticate()
    const second = await authenticate()

    expect(first.user).toMatchObject({
      email: testEmail,
      supabaseUserId,
    })
    expect(second.user?.id).toBe(first.user?.id)

    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { supabaseUserId: { equals: supabaseUserId } },
    })
    expect(users.totalDocs).toBe(1)
  })

  it('does not update the user when mapped claims are unchanged', async () => {
    const before = await authenticate()
    const beforeUpdatedAt = before.user?.updatedAt
    const after = await authenticate()

    expect(after.user?.updatedAt).toBe(beforeUpdatedAt)
  })

  it('creates one user for concurrent first requests', async () => {
    await deleteLinkedUser()

    const results = await Promise.all([authenticate(), authenticate()])
    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { supabaseUserId: { equals: supabaseUserId } },
    })

    expect(users.totalDocs).toBe(1)
    expect(results[0].user?.id).toBe(users.docs[0]?.id)
    expect(results[1].user?.id).toBe(users.docs[0]?.id)
  })

  it('persists and atomically consumes an exchange code once', async () => {
    const authenticated = await authenticate()
    const store = createPayloadExchangeCodeStore(payload)
    const created = await createExchangeCode({
      authCollection: 'users',
      store,
      userId: authenticated.user!.id,
    })

    const results = await Promise.all([
      consumeExchangeCode({ code: created.code, store }),
      consumeExchangeCode({ code: created.code, store }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(results.find(Boolean)).toMatchObject({
      authCollection: 'users',
      userId: authenticated.user!.id,
    })
  })

  it('cleans up expired exchange codes', async () => {
    const authenticated = await authenticate()
    const store = createPayloadExchangeCodeStore(payload)
    const past = new Date(Date.now() - 10_000)
    const created = await createExchangeCode({
      authCollection: 'users',
      now: () => past,
      store,
      ttlMs: 1_000,
      userId: authenticated.user!.id,
    })

    await expect(store.cleanupExpired()).resolves.toBeGreaterThanOrEqual(1)
    await expect(consumeExchangeCode({ code: created.code, store })).resolves.toBeNull()
  })

  it('exchanges a code for a working Payload session cookie exactly once', async () => {
    const authenticated = await authenticate()
    const issueResponse = await handleEndpoints({
      config: payloadConfig,
      request: new Request('http://localhost:3000/api/supabase/exchange-code', {
        headers: {
          authorization: `Bearer ${accessToken}`,
          origin: 'http://localhost:3000',
        },
        method: 'POST',
      }),
    })
    const issued = (await issueResponse.json()) as { code: string }

    expect(issueResponse.status).toBe(201)
    expect(issued.code).toEqual(expect.any(String))

    const request = () =>
      new Request('http://localhost:3000/api/supabase/exchange', {
        body: JSON.stringify({ code: issued.code }),
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
        },
        method: 'POST',
      })

    const response = await handleEndpoints({
      config: payloadConfig,
      request: request(),
    })
    const cookie = response.headers.get('set-cookie')

    expect(response.status).toBe(200)
    expect(cookie).toContain('HttpOnly')

    const sessionAuth = await payload.auth({
      headers: new Headers({
        cookie: cookie!.split(';')[0],
      }),
    })
    expect(sessionAuth.user?.id).toBe(authenticated.user!.id)

    const replay = await handleEndpoints({
      config: payloadConfig,
      request: request(),
    })
    expect(replay.status).toBe(400)

    const logout = await handleEndpoints({
      config: payloadConfig,
      request: new Request('http://localhost:3000/api/users/logout', {
        headers: { cookie: cookie!.split(';')[0] },
        method: 'POST',
      }),
    })
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('payload-token=')

    await expect(
      payload.auth({
        headers: new Headers({ cookie: cookie!.split(';')[0] }),
      }),
    ).resolves.toMatchObject({ user: null })
  })
})
