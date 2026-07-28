import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let accessToken: string
let supabaseUserId: string
let testEmail: string

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
    const payloadConfig = await config
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
})
