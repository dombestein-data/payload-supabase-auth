import type { Endpoint } from 'payload'

import { createExchangeCode } from '../exchange/createExchangeCode.js'
import { createPayloadExchangeCodeStore } from '../exchange/createPayloadExchangeCodeStore.js'
import { defaultExchangeCodeCollection } from '../exchange/exchangeCodeCollection.js'
import { hasAllowedOrigin } from './origin.js'

export type CreateExchangeCodeEndpointOptions = {
  allowedOrigins?: string[]
  authCollection: string
  exchangeCodeCollection?: string
  path?: string
  strategyName?: string
  ttlMs?: number
}

const json = (body: Record<string, unknown>, status: number) =>
  Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })

/** Issues a one-time code to a user authenticated by the Supabase strategy. */
export const createExchangeCodeEndpoint = (
  options: CreateExchangeCodeEndpointOptions,
): Endpoint => ({
  method: 'post',
  path: options.path ?? '/supabase/exchange-code',
  handler: async (req) => {
    if (!hasAllowedOrigin(req, options.allowedOrigins)) {
      return json({ message: 'Forbidden' }, 403)
    }

    const user = req.user as {
      _strategy?: string
      collection?: string
      id?: number | string
    } | null
    if (
      !user ||
      user._strategy !== (options.strategyName ?? 'supabase-bearer') ||
      user.collection !== options.authCollection ||
      (typeof user.id !== 'number' && typeof user.id !== 'string') ||
      user.id === ''
    ) {
      return json({ message: 'Unauthorized' }, 401)
    }

    try {
      const store = createPayloadExchangeCodeStore(
        req.payload,
        options.exchangeCodeCollection ?? defaultExchangeCodeCollection,
      )
      await store.cleanupExpired()
      const result = await createExchangeCode({
        authCollection: options.authCollection,
        store,
        ttlMs: options.ttlMs,
        userId: user.id,
      })

      return json({ code: result.code, expiresAt: result.expiresAt.toISOString() }, 201)
    } catch (error) {
      req.payload.logger.error({
        err: error,
        msg: 'Failed to create a Supabase session exchange code',
      })
      return json({ message: 'Unable to create exchange code' }, 500)
    }
  },
})
