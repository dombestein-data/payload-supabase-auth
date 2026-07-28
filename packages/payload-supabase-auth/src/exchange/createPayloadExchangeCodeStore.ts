import type { CollectionSlug, Payload } from 'payload'
import { and, eq, gt, lte } from 'drizzle-orm'

import {
  defaultExchangeCodeCollection,
  getExchangeCodeTableName,
} from './exchangeCodeCollection.js'
import type { ExchangeCodeRecord, ExchangeCodeStore } from './types.js'

type StoredExchangeCode = {
  authCollection: string
  digest: string
  expiresAt: string
  id: number | string
  userId: string
  userIdType: 'number' | 'string'
}

export type PayloadExchangeCodeStore = ExchangeCodeStore & {
  /** Deletes expired records and returns the number successfully removed. */
  cleanupExpired(now?: Date): Promise<number>
}

const toRecord = (doc: StoredExchangeCode): ExchangeCodeRecord => ({
  authCollection: doc.authCollection,
  digest: doc.digest,
  expiresAt: new Date(doc.expiresAt),
  userId: doc.userIdType === 'number' ? Number(doc.userId) : doc.userId,
})

/**
 * Creates a shared exchange-code store using a hidden Payload collection.
 *
 * Consumption returns a record only after its database deletion succeeds.
 * Concurrent consumers may both observe the lookup, but only one can win the
 * delete and receive the record.
 */
export const createPayloadExchangeCodeStore = (
  payload: Payload,
  collection = defaultExchangeCodeCollection,
): PayloadExchangeCodeStore => {
  const collectionSlug = collection as CollectionSlug
  const database = payload.db as Payload['db'] & {
    drizzle?: {
      delete: (table: unknown) => {
        where: (condition: unknown) => {
          returning: () => Promise<StoredExchangeCode[]>
        }
      }
    }
    tableNameMap?: Map<string, string>
    tables?: Record<string, Record<string, unknown>>
  }
  const defaultTableName = getExchangeCodeTableName(collection)
  const tableName = database.tableNameMap?.get(defaultTableName) ?? defaultTableName
  const table = database.tables?.[tableName]

  if (!database.drizzle || !table) {
    throw new TypeError('Payload exchange-code storage requires the PostgreSQL Drizzle adapter')
  }

  return {
    create: async (record) => {
      await payload.create({
        collection: collectionSlug,
        data: {
          authCollection: record.authCollection,
          digest: record.digest,
          expiresAt: record.expiresAt.toISOString(),
          userId: String(record.userId),
          userIdType: typeof record.userId,
        } as never,
        depth: 0,
        overrideAccess: true,
      })
    },
    consume: async (digest, now) => {
      const docs = (await database
        .drizzle!.delete(table)
        .where(
          and(eq(table.digest as never, digest), gt(table.expiresAt as never, now.toISOString())),
        )
        .returning()) as unknown as StoredExchangeCode[]

      return docs[0] ? toRecord(docs[0]) : null
    },
    cleanupExpired: async (now = new Date()) => {
      const docs = (await database
        .drizzle!.delete(table)
        .where(lte(table.expiresAt as never, now.toISOString()))
        .returning()) as unknown as StoredExchangeCode[]
      return docs.length
    },
  }
}
