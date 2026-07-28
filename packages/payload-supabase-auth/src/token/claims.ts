import type { JWTPayload } from 'jose'

export type SupabaseJwtClaims = JWTPayload & {
  sub: string
  email?: string
  phone?: string
  role?: string
  aal?: 'aal1' | 'aal2'
  session_id?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}
