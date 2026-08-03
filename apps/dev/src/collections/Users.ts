import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'member',
      options: ['admin', 'member'],
      required: true,
      saveToJWT: true,
    },
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
