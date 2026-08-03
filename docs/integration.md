# Integration guide

This guide integrates `@dombestein-data/payload-supabase-auth` into an existing
Payload CMS 3 project. It is written for pnpm, npm, Yarn, and Bun projects and
covers API bearer authentication, automatic user provisioning, claim
synchronization, Payload session exchange, and the optional Supabase panel on
Payload's admin login page.

## 1. Choose the integration mode

| Mode             | Database                   | Included behavior                                                                                                                  |
| ---------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Full integration | Payload PostgreSQL adapter | Bearer authentication, provisioning, synchronization, exchange endpoints, Payload cookie sessions, and optional admin login panel. |
| Bearer only      | Any Payload adapter        | Bearer authentication, provisioning, and synchronization. No exchange collection, cookie exchange, or package admin login panel.   |

The package supports Node.js 20.9 or newer, Payload `^3.87.0`, and React 19.
The host project must use an authentication-enabled Payload collection.

The full integration currently depends on PostgreSQL because one-time exchange
codes are consumed atomically with `DELETE ... RETURNING`. Do not enable the
exchange flow with another adapter.

## 2. Install the package in the Payload project

Install libraries locally in every application that imports them. A global
package installation is not used by Node.js, Next.js, or Payload module
resolution.

```bash
# pnpm
pnpm add @dombestein-data/payload-supabase-auth

# npm
npm install @dombestein-data/payload-supabase-auth

# Yarn
yarn add @dombestein-data/payload-supabase-auth

# Bun
bun add @dombestein-data/payload-supabase-auth
```

Payload and React are peer dependencies. An existing Payload 3 application
normally already provides both. Verify the resolved versions:

```bash
pnpm why payload react @dombestein-data/payload-supabase-auth
```

Replace `pnpm why` with the equivalent package-manager command if necessary.

For a private registry, configure registry authentication before installing;
see [publish.md](publish.md#installing-a-private-package).

## 3. Configure environment variables

Add these values to the deployment platform and local environment. Variable
names can differ as long as the Payload config passes the corresponding values
to the plugin.

```dotenv
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PAYLOAD_SECRET=replace-with-a-long-stable-random-secret
DATABASE_URL=postgresql://user:password@host:5432/database
```

Requirements:

- `SUPABASE_URL` is the project base URL, without `/auth/v1`.
- `SUPABASE_PUBLISHABLE_KEY` must be a browser-safe publishable key or legacy
  anon key. Never pass a Supabase secret or service-role key to the admin
  configuration.
- `PAYLOAD_SECRET` must be strong, stable across deployments, and shared by all
  instances of the same Payload application.
- `DATABASE_URL` is required by the full PostgreSQL integration, not by the
  plugin's bearer-only mode itself.
- Do not commit real environment files, tokens, passwords, cookies, or keys.

Although a Supabase publishable key is intentionally safe for browser use, keep
it in deployment configuration so environments can use different projects.
The package has no runtime configuration editor.

## 4. Add the Supabase identity field

Add a unique, indexed text field to the Payload auth collection. The examples
use `users`; any auth collection slug works.

```ts
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  admin: {
    useAsTitle: 'email',
  },
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
      index: true,
      unique: true,
      admin: {
        description: 'Supabase Auth user ID from the verified JWT subject.',
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
}
```

The `access.admin` rule is required security policy: without it, every
automatically provisioned user could enter Payload admin. Adapt the rule to
your trusted role model. The field-level link rules are optional defense in
depth. The plugin uses
Payload's local API with `overrideAccess: true` after verifying the token, so it
can still provision and link users. If existing hooks require this field, make
sure they permit plugin operations.

If the collection already has an identity field, pass its name as
`userIdField`. It must store the exact Supabase JWT `sub` value and remain
unique.

## 5. Configure the full PostgreSQL integration

Register the collection before the plugin and keep the normal Payload admin
configuration intact:

```ts
import { postgresAdapter } from '@payloadcms/db-postgres'
import { supabaseAuthPlugin } from '@dombestein-data/payload-supabase-auth'
import { buildConfig } from 'payload'

import { Users } from './collections/Users'

const requiredEnv = (name: string): string => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const databaseUrl = requiredEnv('DATABASE_URL')
const payloadSecret = requiredEnv('PAYLOAD_SECRET')
const supabaseUrl = requiredEnv('SUPABASE_URL')
const supabasePublishableKey = requiredEnv('SUPABASE_PUBLISHABLE_KEY')

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users],
  db: postgresAdapter({
    pool: {
      connectionString: databaseUrl,
    },
  }),
  secret: payloadSecret,
  plugins: [
    supabaseAuthPlugin({
      admin: {
        publishableKey: supabasePublishableKey,
      },
      authCollection: Users.slug,
      disablePayloadLocalAuth: true,
      mfa: {
        policy: 'if-enrolled',
      },
      provisionUsers: true,
      supabaseUrl,
      synchronizeUsers: true,
    }),
  ],
})
```

This configuration adds:

- The `supabase-bearer` auth strategy to `users`.
- The hidden `supabase-exchange-codes` collection.
- `POST /api/supabase/exchange-code`.
- `POST /api/supabase/exchange`.
- A Supabase email/password panel with adaptive MFA.
- Supabase-authoritative credentials: Payload-local login and password
  recovery are disabled while normal Payload session logout remains available.

The plugin logs an error and renders a visible admin-page warning if the admin
URL, publishable key, or exchange endpoints are missing. It does not expose a
settings page and does not make environment values editable.

### Custom Payload routes

The plugin derives endpoint and admin URLs from Payload's `routes.api` and
`routes.admin`. No additional configuration is needed:

```ts
export default buildConfig({
  routes: {
    admin: '/control',
    api: '/service',
  },
  // collections, db, plugins, and secret...
})
```

In this example, the exchange endpoints become
`/service/supabase/exchange-code` and `/service/supabase/exchange`.

### Customize the admin panel text

```ts
supabaseAuthPlugin({
  admin: {
    description: 'Use your company account to continue.',
    heading: 'Company sign in',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  authCollection: 'users',
  supabaseUrl: process.env.SUPABASE_URL,
})
```

The default `if-enrolled` MFA policy requires AAL2 only when the user has a
verified Supabase TOTP or phone factor. Users without factors are not forced to
enroll. Use `required` to mandate MFA for every user or `disabled` only after a
security review. Credential changes and recovery belong in Supabase or the
upstream account system, not Payload.

## 6. Configure bearer-only mode

Use this mode with MongoDB, SQLite, another adapter, or an API that does not
need Payload cookie sessions:

```ts
supabaseAuthPlugin({
  authCollection: 'users',
  enableExchangeCodes: false,
  provisionUsers: true,
  supabaseUrl: process.env.SUPABASE_URL,
  synchronizeUsers: true,
})
```

Do not provide the `admin` option in bearer-only mode. The included admin panel
needs both exchange endpoints to create the Payload cookie.

## 7. Map claims safely

The default mapper synchronizes `email`. Add application fields with
`mapClaims`:

```ts
supabaseAuthPlugin({
  authCollection: 'users',
  provisionUsers: true,
  supabaseUrl: process.env.SUPABASE_URL,
  synchronizeUsers: true,
  mapClaims: (claims) => ({
    displayName:
      typeof claims.user_metadata?.display_name === 'string'
        ? claims.user_metadata.display_name
        : undefined,
    role:
      claims.app_metadata?.role === 'admin' || claims.app_metadata?.role === 'editor'
        ? claims.app_metadata.role
        : 'member',
  }),
})
```

Security rules:

- Treat `user_metadata` as user-editable profile data.
- Put authorization data in server-controlled `app_metadata`.
- Validate roles against an explicit allow-list.
- Return only fields that exist on the Payload collection.
- Never map `id`, `password`, `collection`, or the Supabase link field. The
  package also blocks those fields defensively.

Provisioning requires a non-empty verified email claim. If the application
does not guarantee email claims, provide a policy upstream or pre-create linked
Payload users and leave `provisionUsers` disabled.

## 8. Configure cross-origin frontends

Same-origin requests are allowed by default. If a browser application is on a
different origin, configure the same exact origins in Payload and the plugin:

```ts
const trustedOrigins = ['https://app.example.com', 'https://preview.example.com']

export default buildConfig({
  cors: trustedOrigins,
  csrf: trustedOrigins,
  plugins: [
    supabaseAuthPlugin({
      authCollection: 'users',
      exchangeAllowedOrigins: trustedOrigins,
      supabaseUrl: process.env.SUPABASE_URL,
    }),
  ],
})
```

Credentialed cookies sent across sites also require the auth collection to use
`SameSite=None` and `Secure`:

```ts
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    cookies: {
      sameSite: 'None',
      secure: true,
    },
  },
  // access and fields...
}
```

Use exact HTTPS origins without paths. Do not use `*` with credentialed
requests. Confirm the production reverse proxy forwards the original host and
protocol so Payload derives the correct request origin.

## 9. Generate schema migrations

Install and configure the plugin before generating the migration. The migration
must include both the unique user link and, for full mode, the hidden exchange
collection.

Typical Payload commands are:

```bash
# Generate a migration after reviewing the config
pnpm payload migrate:create add_supabase_auth

# Apply committed migrations in the target environment
pnpm payload migrate
```

If the project exposes Payload through another script, use its equivalent, for
example `pnpm exec payload migrate:create`. Review generated SQL before
committing it. Confirm it contains:

- The `supabaseUserId` column or configured `userIdField`.
- A unique index on the identity field.
- The `supabase-exchange-codes` table and unique digest index in full mode.
- An index supporting exchange-code expiry cleanup.

Back up production data before applying schema changes. If existing users must
be linked, backfill Supabase subjects using a reviewed migration or
administrative script before enabling authentication traffic.

## 10. Generate Payload's admin import map

This step is required when the `admin` option is enabled:

```bash
pnpm payload generate:importmap
```

Commit the generated import-map file if the host project's Payload workflow
tracks it. It should import `SupabaseLogin` from:

```text
@dombestein-data/payload-supabase-auth/client
```

If generation cannot see environment variables, load the same environment used
by the Payload config. Never paste secret values into the generated file. Only
the Supabase URL and browser-safe publishable key are passed to the client.

## 11. Use bearer authentication from an API client

Send the Supabase access token to a Payload route:

```ts
const response = await fetch('https://cms.example.com/api/users/me', {
  headers: {
    Authorization: `Bearer ${supabaseAccessToken}`,
  },
})
```

The strategy verifies the JWT signature, issuer, audience, algorithm, time
claims, and subject before resolving or provisioning a Payload user. A failed
Supabase strategy returns no authenticated user and lets Payload try its other
configured strategies.

Do not send the publishable key as the bearer token. The bearer value must be a
user access token returned by Supabase Auth.

## 12. Create a Payload browser session from a custom UI

The included admin panel performs this automatically for password login. For
OAuth, magic links, or a separate frontend, exchange the access token yourself:

```ts
const issueResponse = await fetch('https://cms.example.com/api/supabase/exchange-code', {
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${supabaseAccessToken}`,
  },
  method: 'POST',
})

if (!issueResponse.ok) {
  throw new Error('Unable to begin the Payload session exchange')
}

const { code } = (await issueResponse.json()) as { code: string }

const exchangeResponse = await fetch('https://cms.example.com/api/supabase/exchange', {
  body: JSON.stringify({ code }),
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
  method: 'POST',
})

if (!exchangeResponse.ok) {
  throw new Error('Unable to create the Payload session')
}
```

The raw code is short-lived and single-use. Keep the Supabase token and code in
memory only. Do not place either in URLs, local storage, analytics, or logs.

## 13. Log out

Use Payload's standard auth-collection endpoint:

```ts
await fetch('https://cms.example.com/api/users/logout', {
  credentials: 'include',
  method: 'POST',
})
```

Replace `users` with the configured auth collection slug. With Payload sessions
enabled, this clears the cookie and revokes its persisted session ID.

## 14. Build and deploy

Run the host project's normal checks after configuration and migration:

```bash
pnpm payload generate:types
pnpm payload generate:importmap
pnpm typecheck
pnpm lint
pnpm build
```

Before enabling production traffic:

1. Apply the migration.
2. Confirm every application instance uses the same Payload secret and
   PostgreSQL database.
3. Confirm the Supabase URL points to the intended environment.
4. Confirm only a browser-safe publishable key reaches the login page.
5. Test a real Supabase login, provisioning, `/api/users/me`, admin access, and
   logout.
6. Confirm a replayed exchange code fails.
7. Confirm a tampered or wrong-project token does not create a user.
8. Confirm Payload-local login and recovery are unavailable.
9. Test both tenant-relevant MFA branches: no factor at AAL1 and an enrolled
   factor at AAL2.
10. Monitor failures without logging credentials or tokens.

## 15. Troubleshooting

### The admin page shows a configuration warning

Make sure `admin.publishableKey`, the top-level `supabaseUrl` (or
`admin.supabaseUrl`), and both exchange endpoints are enabled. Restart Payload
and regenerate the import map after changing configuration.

### The package client component cannot be resolved

Confirm the installed version exports
`@dombestein-data/payload-supabase-auth/client`, rebuild the package if using a
workspace link, and regenerate Payload's import map.

### A valid token does not authenticate

Check that:

- The token is a Supabase user access token, not a publishable key.
- `supabaseUrl` matches the token's project and issuer.
- The expected audience is `authenticated`, unless explicitly overridden.
- The token contains a non-empty `sub`.
- A linked user exists, or provisioning is enabled.
- The link field has no duplicate values.

### Provisioning fails

Confirm the token has a non-empty email, required collection fields are
provided by `mapClaims` or defaults, and collection hooks accept the generated
data. Inspect server errors without printing the token.

### Exchange returns an origin error

Check the browser's exact `Origin`, Payload `cors` and `csrf`, plugin
`exchangeAllowedOrigins`, reverse-proxy headers, HTTPS scheme, and
`credentials: 'include'`.

### Exchange storage fails

Confirm the full integration uses Payload's PostgreSQL adapter and the exchange
collection migration has been applied. Use `enableExchangeCodes: false` with
other adapters.

### Login works but admin access is denied

Authentication and authorization are separate. Check the auth collection's
access functions and application role policy. Map roles only from trusted,
validated claims.

## 16. Updating or removing the integration

For upgrades, read the package changelog, update the dependency, regenerate
types and import maps, create any required migration, then repeat the smoke
checks above.

To remove the integration:

1. Remove the plugin from Payload config.
2. Regenerate the import map and Payload types.
3. Verify another authentication path before deployment.
4. Remove the exchange collection and identity field only through a reviewed,
   backed-up migration after confirming their data is no longer needed.
5. Remove environment values only after every deployed instance no longer uses
   them.

Never drop production auth data as part of a routine package uninstall.
