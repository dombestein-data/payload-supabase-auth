import { randomUUID } from 'node:crypto'

import {
  getFieldsToSign,
  jwtSign,
  type AuthCollectionSlug,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { createPayloadSessionCookie } from './sessionCookie.js'

export type CreatePayloadSessionOptions = {
  authCollection: string
  payload: Payload
  req?: Partial<PayloadRequest>
  userId: number | string
}

export type CreatedPayloadSession = {
  cookie: string
  exp: number
  token: string
  user: Record<string, unknown>
}

/** Creates a Payload JWT and, when enabled, persists its session ID. */
export const createPayloadSession = async (
  options: CreatePayloadSessionOptions,
): Promise<CreatedPayloadSession> => {
  const collection = options.payload.collections[options.authCollection as AuthCollectionSlug]
  if (!collection?.config.auth) {
    throw new TypeError(`Payload auth collection "${options.authCollection}" was not found`)
  }

  const auth = collection.config.auth
  let user = (await options.payload.findByID({
    collection: options.authCollection as AuthCollectionSlug,
    depth: 0,
    id: options.userId,
    overrideAccess: true,
    req: options.req,
    showHiddenFields: true,
  })) as unknown as Record<string, unknown>

  let sid: string | undefined
  if (auth.useSessions) {
    const now = new Date()
    sid = randomUUID()
    const sessions = Array.isArray(user.sessions)
      ? user.sessions.filter((session) => {
          if (!session || typeof session !== 'object' || !('expiresAt' in session)) {
            return false
          }
          return new Date(String(session.expiresAt)).getTime() > now.getTime()
        })
      : []
    sessions.push({
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + auth.tokenExpiration * 1_000).toISOString(),
      id: sid,
    })

    user = (await options.payload.update({
      collection: options.authCollection as AuthCollectionSlug,
      data: { sessions } as never,
      depth: 0,
      id: options.userId,
      overrideAccess: true,
      req: options.req,
    })) as unknown as Record<string, unknown>
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection.config,
    email: typeof user.email === 'string' ? user.email : '',
    sid,
    user: user as never,
  })
  const { exp, token } = await jwtSign({
    fieldsToSign,
    secret: options.payload.secret,
    tokenExpiration: auth.tokenExpiration,
  })
  const cookie = createPayloadSessionCookie({
    cookiePrefix: options.payload.config.cookiePrefix,
    domain: auth.cookies.domain || undefined,
    expires: new Date(exp * 1_000),
    sameSite: auth.cookies.sameSite,
    secure: auth.cookies.secure,
    token,
  })

  return { cookie, exp, token, user }
}
