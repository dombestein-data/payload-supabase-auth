import { createHash } from 'node:crypto'

export const digestExchangeCode = (code: string): string =>
  createHash('sha256').update(code, 'utf8').digest('base64url')
