export { supabaseAuthPlugin } from './plugin.js'
export { consumeExchangeCode } from './exchange/consumeExchangeCode.js'
export { createExchangeCode } from './exchange/createExchangeCode.js'
export { createMemoryExchangeCodeStore } from './exchange/createMemoryExchangeCodeStore.js'
export { createPayloadExchangeCodeStore } from './exchange/createPayloadExchangeCodeStore.js'
export { createPayloadSession } from './exchange/createPayloadSession.js'
export { createPayloadSessionCookie } from './exchange/sessionCookie.js'
export { digestExchangeCode } from './exchange/digestExchangeCode.js'
export {
  createExchangeCodeCollection,
  defaultExchangeCodeCollection,
  getExchangeCodeTableName,
} from './exchange/exchangeCodeCollection.js'
export { createSupabaseStrategy } from './strategy/createSupabaseStrategy.js'
export { createExchangeCodeEndpoint } from './endpoints/exchangeCode.js'
export { createExchangeEndpoint } from './endpoints/exchange.js'
export { extractBearerToken } from './token/extractBearerToken.js'
export { createSupabaseTokenVerifier } from './token/verifyToken.js'
export { resolveLinkedUser } from './users/resolveLinkedUser.js'
export { mapDefaultClaims } from './users/claimMapping.js'
export { provisionUser } from './users/provisionUser.js'
export { synchronizeUser } from './users/synchronizeUser.js'
export type { CreateSupabaseStrategyOptions } from './strategy/createSupabaseStrategy.js'
export type { SupabaseJwtClaims } from './token/claims.js'
export type { SupabaseTokenVerifier, SupabaseTokenVerifierOptions } from './token/verifyToken.js'
export type { PayloadSupabaseAuthOptions, SupabaseAdminOptions } from './types.js'
export type { ConsumeExchangeCodeOptions } from './exchange/consumeExchangeCode.js'
export type { CreateExchangeCodeOptions } from './exchange/createExchangeCode.js'
export type {
  CreatedExchangeCode,
  ExchangeCodeRecord,
  ExchangeCodeStore,
} from './exchange/types.js'
export type { PayloadExchangeCodeStore } from './exchange/createPayloadExchangeCodeStore.js'
export type {
  CreatedPayloadSession,
  CreatePayloadSessionOptions,
} from './exchange/createPayloadSession.js'
export type { SessionCookieOptions } from './exchange/sessionCookie.js'
export type { CreateExchangeCodeEndpointOptions } from './endpoints/exchangeCode.js'
export type { CreateExchangeEndpointOptions } from './endpoints/exchange.js'
export type { LinkedUser, ResolveLinkedUserOptions } from './users/resolveLinkedUser.js'
export type { ClaimMapper } from './users/claimMapping.js'
export type { ProvisionUserOptions } from './users/provisionUser.js'
export type { SynchronizeUserOptions } from './users/synchronizeUser.js'
