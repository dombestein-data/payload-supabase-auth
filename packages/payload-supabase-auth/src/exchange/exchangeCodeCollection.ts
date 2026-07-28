import type { CollectionConfig } from 'payload'

export const defaultExchangeCodeCollection = 'supabase-exchange-codes'

export const getExchangeCodeTableName = (slug: string): string =>
  slug.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()

/** Internal collection used by the shared Payload exchange-code store. */
export const createExchangeCodeCollection = (
  slug = defaultExchangeCodeCollection,
): CollectionConfig => ({
  slug,
  dbName: getExchangeCodeTableName(slug),
  access: {
    create: () => false,
    delete: () => false,
    read: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'digest',
      type: 'text',
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'authCollection',
      type: 'text',
      index: true,
      required: true,
    },
    {
      name: 'userId',
      type: 'text',
      required: true,
    },
    {
      name: 'userIdType',
      type: 'select',
      options: ['number', 'string'],
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      required: true,
    },
  ],
  timestamps: false,
})
