import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'supabaseUserId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'The linked Supabase Auth user ID (the JWT subject claim).',
        readOnly: true,
      },
    },
  ],
}
