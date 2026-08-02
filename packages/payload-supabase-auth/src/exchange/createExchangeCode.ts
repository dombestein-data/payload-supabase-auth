import { randomBytes } from 'node:crypto'

import { digestExchangeCode } from './digestExchangeCode.js'
import type { CreatedExchangeCode, ExchangeCodeStore } from './types.js'

const defaultTTL = 60_000

export type CreateExchangeCodeOptions = {
  authCollection: string
  store: ExchangeCodeStore
  userId: number | string
  ttlMs?: number

  /** Test seam for deterministic time. */
  now?: () => Date

  /** Test seam for deterministic entropy. Must return at least 32 bytes. */
  generateBytes?: () => Uint8Array
}

/** Creates and stores a short-lived opaque, single-use exchange code. */
export const createExchangeCode = async (
  options: CreateExchangeCodeOptions,
): Promise<CreatedExchangeCode> => {
  const ttlMs = options.ttlMs ?? defaultTTL
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new TypeError('Exchange code TTL must be a positive safe integer')
  }
  if (!options.authCollection || options.userId === '') {
    throw new TypeError('Exchange code requires a collection and user ID')
  }

  const bytes = options.generateBytes?.() ?? randomBytes(32)
  if (bytes.byteLength < 32) {
    throw new TypeError('Exchange codes require at least 256 bits of entropy')
  }

  const code = Buffer.from(bytes).toString('base64url')
  const now = options.now?.() ?? new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  await options.store.create({
    authCollection: options.authCollection,
    digest: digestExchangeCode(code),
    expiresAt,
    userId: options.userId,
  })

  return { code, expiresAt }
}
