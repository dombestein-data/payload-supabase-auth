import type { ExchangeCodeRecord, ExchangeCodeStore } from './types.js'

/**
 * In-memory store for tests and single-process development.
 *
 * Production and multi-instance deployments must use a shared store with an
 * atomic delete-and-return operation.
 */
export const createMemoryExchangeCodeStore = (): ExchangeCodeStore => {
  const records = new Map<string, ExchangeCodeRecord>()

  return {
    create: async (record) => {
      if (records.has(record.digest)) {
        throw new Error('Exchange code digest already exists')
      }
      records.set(record.digest, record)
    },
    consume: async (digest, now) => {
      const record = records.get(digest)
      if (!record) {
        return null
      }

      // Delete before returning so a second consumer cannot observe it.
      records.delete(digest)
      return record.expiresAt.getTime() > now.getTime() ? record : null
    },
  }
}
