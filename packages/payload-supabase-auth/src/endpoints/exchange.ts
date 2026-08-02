import type { Endpoint, PayloadRequest } from 'payload'

import { consumeExchangeCode } from '../exchange/consumeExchangeCode.js'
import { createPayloadExchangeCodeStore } from '../exchange/createPayloadExchangeCodeStore.js'
import { createPayloadSession } from '../exchange/createPayloadSession.js'
import { defaultExchangeCodeCollection } from '../exchange/exchangeCodeCollection.js'
import { hasAllowedOrigin } from './origin.js'

export type CreateExchangeEndpointOptions = {
  allowedOrigins?: string[]
  authCollection: string
  exchangeCodeCollection?: string
  path?: string
}

const json = (body: Record<string, unknown>, status: number, headers?: HeadersInit) =>
  Response.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
    status,
  })

const readCode = async (req: PayloadRequest): Promise<string> => {
  let data = req.data
  if (!data) {
    const parseJSON = req.json
    if (!parseJSON) return ''
    try {
      data = (await parseJSON.call(req)) as PayloadRequest['data']
    } catch {
      return ''
    }
  }
  return typeof data?.code === 'string' ? data.code : ''
}

/** Exchanges one opaque code for a Payload session cookie. */
export const createExchangeEndpoint = (options: CreateExchangeEndpointOptions): Endpoint => ({
  method: 'post',
  path: options.path ?? '/supabase/exchange',
  handler: async (req) => {
    if (!hasAllowedOrigin(req, options.allowedOrigins)) {
      return json({ message: 'Forbidden' }, 403)
    }

    const code = await readCode(req)
    if (!code) {
      return json({ message: 'Invalid or expired exchange code' }, 400)
    }

    const store = createPayloadExchangeCodeStore(
      req.payload,
      options.exchangeCodeCollection ?? defaultExchangeCodeCollection,
    )
    const record = await consumeExchangeCode({ code, store })
    if (!record || record.authCollection !== options.authCollection) {
      return json({ message: 'Invalid or expired exchange code' }, 400)
    }

    try {
      const session = await createPayloadSession({
        authCollection: options.authCollection,
        payload: req.payload,
        req,
        userId: record.userId,
      })
      return json({ exp: session.exp }, 200, { 'Set-Cookie': session.cookie })
    } catch (error) {
      req.payload.logger.error({
        err: error,
        msg: 'Failed to create a Payload session from an exchange code',
      })
      return json({ message: 'Invalid or expired exchange code' }, 400)
    }
  },
})
