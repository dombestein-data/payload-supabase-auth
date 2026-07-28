# Payload Supabase Auth

`@dombestein-data/payload-supabase-auth` connects Supabase Auth access tokens to
an authentication-enabled [Payload CMS](https://payloadcms.com/) collection.
Requests carrying a valid Supabase bearer token are authenticated as the
Payload user whose `supabaseUserId` matches the token's `sub` claim.

The project is under active development. The current release supports bearer
authentication, opt-in user provisioning, and opt-in claim synchronization.
Payload session exchange, logout endpoints, and a Supabase admin login UI are
not implemented yet. Secure exchange-code primitives exist but are not exposed
through HTTP endpoints.

## Current authentication flow

1. A client sends `Authorization: Bearer <supabase-access-token>`.
2. The plugin verifies the token against the Supabase project's JWKS.
3. Verification checks the signature, algorithm, issuer, audience, expiry, and
   presence of a non-empty subject.
4. Payload looks up one user whose configured link field equals the subject.
5. If provisioning is enabled and no link exists, Payload creates the user.
6. If synchronization is enabled, changed mapped claims are persisted.
7. The request is authenticated as that Payload user using the
   `supabase-bearer` strategy.

Anonymous requests, malformed headers, invalid tokens, missing links, resolver
failures, and duplicate links fail closed and return no authenticated user from
this strategy. Other configured Payload strategies may still run.

## Installation

This repository uses a pnpm workspace while the package is developed locally:

```bash
pnpm install
```

Published-package installation will use:

```bash
pnpm add @dombestein-data/payload-supabase-auth
```

The package requires Node.js 20.9 or newer and Payload 3.86 or newer within the
current Payload 3 major version.

## Payload configuration

Add an indexed, unique link field to the auth collection:

```ts
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [
    {
      name: 'supabaseUserId',
      type: 'text',
      index: true,
      unique: true,
      admin: {
        readOnly: true,
      },
    },
  ],
}
```

Install the plugin after registering the collection:

```ts
import { supabaseAuthPlugin } from '@dombestein-data/payload-supabase-auth'
import { buildConfig } from 'payload'

import { Users } from './collections/Users'

export default buildConfig({
  collections: [Users],
  plugins: [
    supabaseAuthPlugin({
      authCollection: Users.slug,
      provisionUsers: true,
      supabaseUrl: process.env.SUPABASE_URL,
      synchronizeUsers: true,
    }),
  ],
})
```

`supabaseUrl` must be a project base URL such as
`https://project-ref.supabase.co`. It is required unless a custom
`verifyToken` function is supplied.

When provisioning is disabled, the linked Payload user must exist before
authentication. Its `supabaseUserId` must equal the Supabase user's UUID found
in the JWT `sub` claim.

## Plugin options

| Option                   | Type                    | Default                              | Description                                                           |
| ------------------------ | ----------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `authCollection`         | `string`                | Required                             | Payload auth collection containing linked users.                      |
| `supabaseUrl`            | `string`                | Required unless `verifyToken` is set | Supabase project base URL.                                            |
| `issuer`                 | `string`                | `<supabaseUrl>/auth/v1`              | Expected JWT issuer.                                                  |
| `audience`               | `string \| string[]`    | `authenticated`                      | Expected JWT audience.                                                |
| `userIdField`            | `string`                | `supabaseUserId`                     | Payload field storing the Supabase subject.                           |
| `verifyToken`            | `SupabaseTokenVerifier` | Remote JWKS verifier                 | Custom verifier for testing or non-standard transports.               |
| `provisionUsers`         | `boolean`               | `false`                              | Create an unlinked user from verified claims.                         |
| `synchronizeUsers`       | `boolean`               | `false`                              | Update changed mapped fields during authentication.                   |
| `mapClaims`              | `ClaimMapper`           | Maps `email`                         | Maps verified claims to Payload fields for both lifecycle operations. |
| `exchangeCodeCollection` | `string`                | `supabase-exchange-codes`            | Internal shared exchange-code collection slug.                        |
| `enableExchangeCodes`    | `boolean`               | `true`                               | Set `false` to omit the internal collection.                          |
| `enabled`                | `boolean`               | `true`                               | When `false`, returns the incoming Payload config unchanged.          |

The plugin rejects startup configuration when the selected collection is
missing, is not auth-enabled, or has neither `supabaseUrl` nor a custom
verifier. Existing auth settings and strategies are preserved, and the
Supabase strategy is appended.

Provisioning requires a non-empty email claim. Payload local auth requires a
password when creating an auth user, so the plugin generates a strong random
password which is never returned. Claim synchronization never writes `id`,
`password`, `collection`, or the configured Supabase link field.

Custom claim mapping can populate application fields:

```ts
supabaseAuthPlugin({
  authCollection: 'users',
  supabaseUrl: process.env.SUPABASE_URL,
  provisionUsers: true,
  synchronizeUsers: true,
  mapClaims: (claims) => ({
    displayName: claims.user_metadata?.display_name,
    role: claims.app_metadata?.role,
  }),
})
```

Only map authorization fields such as roles from claims controlled by trusted
server-side code. Supabase `user_metadata` is user-editable and should not grant
privileges.

## Lower-level APIs

The package also exports:

- `extractBearerToken(headers)` for strict, case-insensitive Bearer parsing.
- `createSupabaseTokenVerifier(options)` for reusable JWT verification.
- `resolveLinkedUser(payload, options)` for subject-to-user lookup.
- `provisionUser(payload, options)` and `synchronizeUser(payload, options)` for
  identity lifecycle handling.
- `createExchangeCode(options)` and `consumeExchangeCode(options)` for
  short-lived, single-use exchange primitives.
- `createPayloadExchangeCodeStore(payload)` for shared PostgreSQL persistence.
- `createSupabaseStrategy(options)` for manual strategy installation.

Exchange codes contain at least 256 bits of entropy and only their SHA-256
digests are stored. `createMemoryExchangeCodeStore()` is for tests and
single-process development only. The Payload store uses the plugin's hidden
collection and atomic PostgreSQL `DELETE … RETURNING` consumption.

See the [plain-language overview](docs/overview.md),
[architecture](docs/architecture.md), [security](docs/security.md), and
[token-exchange design](docs/token-exchange.md), and [test coverage](TESTS.md)
for implementation details and current boundaries.

## Development

```bash
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
```

The package unit tests do not require a database, network access, or a Supabase
project.
