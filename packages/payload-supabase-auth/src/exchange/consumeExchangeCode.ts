import { digestExchangeCode } from './digestExchangeCode.js'
import type { ExchangeCodeRecord, ExchangeCodeStore } from './types.js'

export type ConsumeExchangeCodeOptions = {
  code: string
  store: ExchangeCodeStore

  /** Test seam for deterministic time. */
  now?: () => Date
}

/** Atomically consumes an exchange code, returning its linked Payload user. */
export const consumeExchangeCode = async (
  options: ConsumeExchangeCodeOptions,
): Promise<ExchangeCodeRecord | null> => {
  if (!options.code) {
    return null
  }

  const now = options.now?.() ?? new Date()
  const record = await options.store.consume(
    digestExchangeCode(options.code),
    now,
  )

  if (!record || record.expiresAt.getTime() <= now.getTime()) {
    return null
  }

  return record
}
