import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { supabaseAuthPlugin } from '@dombestein-data/payload-supabase-auth'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const adminEmails = new Set(
  (process.env.SUPABASE_ADMIN_EMAILS ?? process.env.SUPABASE_TEST_EMAIL ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    supabaseAuthPlugin({
      admin: {
        publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      },
      authCollection: Users.slug,
      disablePayloadLocalAuth: true,
      mapClaims: (claims) => ({
        email: claims.email,
        role:
          claims.app_metadata?.role === 'admin' ||
          (claims.email && adminEmails.has(claims.email.toLowerCase()))
            ? 'admin'
            : 'member',
      }),
      mfa: {
        policy: 'if-enrolled',
      },
      provisionUsers: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      synchronizeUsers: true,
    }),
  ],
})
