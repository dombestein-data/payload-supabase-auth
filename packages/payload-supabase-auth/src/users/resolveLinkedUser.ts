import type { AuthCollectionSlug, AuthStrategyResult, Payload, Where } from 'payload'

export type ResolveLinkedUserOptions = {
  /** Payload collection containing the linked user. */
  authCollection: string

  /** The verified Supabase JWT subject (`sub`). */
  subject: string

  /** The field which stores the Supabase user ID. */
  userIdField?: string

  /** Use a depth of 0 for GraphQL authentication, matching Payload's strategies. */
  depth?: number
}

export type LinkedUser = NonNullable<AuthStrategyResult['user']>

/**
 * Finds the Payload user linked to a verified Supabase subject.
 *
 * Access control is deliberately bypassed because authentication must be able
 * to resolve a user before `req.user` exists. A non-unique link fails closed.
 */
export const resolveLinkedUser = async (
  payload: Payload,
  options: ResolveLinkedUserOptions,
): Promise<LinkedUser | null> => {
  const userIdField = options.userIdField ?? 'supabaseUserId'
  const result = await payload.find({
    collection: options.authCollection as AuthCollectionSlug,
    depth: options.depth ?? 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
    where: {
      [userIdField]: {
        equals: options.subject,
      },
    } as Where,
  })

  if (result.docs.length === 0) {
    return null
  }

  if (result.docs.length > 1) {
    throw new Error(
      `Multiple users in "${options.authCollection}" are linked to Supabase subject "${options.subject}"`,
    )
  }

  return result.docs[0] as LinkedUser
}
