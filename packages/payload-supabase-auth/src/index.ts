export { supabaseAuthPlugin } from './plugin.js'
export { consumeExchangeCode } from './exchange/consumeExchangeCode.js'
export { createExchangeCode } from './exchange/createExchangeCode.js'
export { createMemoryExchangeCodeStore } from './exchange/createMemoryExchangeCodeStore.js'
export { digestExchangeCode } from './exchange/digestExchangeCode.js'
export { createSupabaseStrategy } from './strategy/createSupabaseStrategy.js'
export { extractBearerToken } from './token/extractBearerToken.js'
export { createSupabaseTokenVerifier } from './token/verifyToken.js'
export { resolveLinkedUser } from './users/resolveLinkedUser.js'
export { mapDefaultClaims } from './users/claimMapping.js'
export { provisionUser } from './users/provisionUser.js'
export { synchronizeUser } from './users/synchronizeUser.js'
export type { CreateSupabaseStrategyOptions } from './strategy/createSupabaseStrategy.js'
export type { SupabaseJwtClaims } from './token/claims.js'
export type {
  SupabaseTokenVerifier,
  SupabaseTokenVerifierOptions,
} from './token/verifyToken.js'
export type { PayloadSupabaseAuthOptions } from './types.js'
export type {
  ConsumeExchangeCodeOptions,
} from './exchange/consumeExchangeCode.js'
export type {
  CreateExchangeCodeOptions,
} from './exchange/createExchangeCode.js'
export type {
  CreatedExchangeCode,
  ExchangeCodeRecord,
  ExchangeCodeStore,
} from './exchange/types.js'
export type {
  LinkedUser,
  ResolveLinkedUserOptions,
} from './users/resolveLinkedUser.js'
export type { ClaimMapper } from './users/claimMapping.js'
export type { ProvisionUserOptions } from './users/provisionUser.js'
export type { SynchronizeUserOptions } from './users/synchronizeUser.js'
