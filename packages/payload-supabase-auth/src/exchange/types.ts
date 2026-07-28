export type ExchangeCodeRecord = {
  authCollection: string
  digest: string
  expiresAt: Date
  userId: number | string
}

export type ExchangeCodeStore = {
  /** Stores a new digest. Implementations must reject duplicate digests. */
  create(record: ExchangeCodeRecord): Promise<void>

  /**
   * Atomically removes and returns an unexpired record.
   *
   * Implementations must return null for missing or expired records and must
   * ensure that concurrent consumers cannot both receive the same record.
   */
  consume(digest: string, now: Date): Promise<ExchangeCodeRecord | null>
}

export type CreatedExchangeCode = {
  /** Opaque value returned to the client. Never persist or log this value. */
  code: string
  expiresAt: Date
}
