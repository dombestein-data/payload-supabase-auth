# Test suite

The package currently has 71 isolated tests across 13 files. They require
no database, Supabase project, environment variables, or network access.

## Plugin configuration

File: `packages/payload-supabase-auth/tests/plugin.test.ts`

The 15 plugin tests verify that:

- `supabaseAuthPlugin` returns a Payload config transformer.
- Enabling the plugin installs a named `supabase-bearer` strategy.
- The transformer does not mutate the incoming config.
- Existing auth options and strategies are preserved.
- `enabled: false` returns the original config reference unchanged.
- A missing or non-auth collection is rejected.
- Enabled configuration requires either `supabaseUrl` or `verifyToken`.
- The hidden exchange-code collection and exchange endpoint can be configured
  or omitted.
- Existing endpoints are preserved.
- A conflicting POST exchange path is rejected.
- The opt-in admin component preserves existing login components and receives
  custom Payload routes.
- Missing admin configuration produces a startup diagnostic and visual-warning
  props.
- The admin component can be disabled independently.

The tests inject a verifier and operate on in-memory Payload configuration.

## Bearer-token extraction

File: `packages/payload-supabase-auth/tests/extractBearerToken.test.ts`

The six extraction tests cover case-insensitive Bearer parsing, missing
Authorization headers, other schemes, missing credentials, whitespace inside a
credential, and values with no authentication scheme.

## Supabase JWT verification

File: `packages/payload-supabase-auth/tests/verifyToken.test.ts`

The six verification tests generate ephemeral ES256 keys and JWTs in memory.
They cover:

- Returning claims for a trusted, valid access token.
- Rejecting an untrusted signing key.
- Rejecting the wrong issuer.
- Rejecting the wrong audience.
- Rejecting an expired token.
- Rejecting a token without a subject.

Remote JWKS networking is intentionally excluded. Tests pass a local `jose`
JWKS resolver to exercise the same signature and claim-verification path.

## Linked-user resolution

File: `packages/payload-supabase-auth/tests/resolveLinkedUser.test.ts`

The three resolver tests verify:

- Exact subject lookup in the configured collection and link field.
- Access bypass, disabled pagination, bounded results, and default depth.
- `null` for an unlinked subject.
- An integrity error when a subject is linked more than once.

Payload's local API is mocked; no adapter or database is required.

## Payload bearer strategy

File: `packages/payload-supabase-auth/tests/createSupabaseStrategy.test.ts`

The seven strategy tests verify:

- Successful extraction, verification, lookup, and Payload user annotation.
- Requests without a bearer token do not invoke verification.
- Invalid tokens and unlinked users fail closed.
- GraphQL authentication forces lookup depth zero.
- Unlinked users are provisioned when enabled.
- Linked users are synchronized when enabled.

The verifier and resolver are injected to keep these tests deterministic.

## User lifecycle

File: `packages/payload-supabase-auth/tests/userLifecycle.test.ts`

The six lifecycle tests cover default provisioning, custom claim mapping,
missing-email rejection, changed-field synchronization, no-op synchronization,
and protection of identity/password fields.

## Stateful lifecycle integration

File: `packages/payload-supabase-auth/tests/lifecycle.integration.test.ts`

The eight stateful integration cases run the real strategy and lifecycle
functions against an in-memory Payload local-API boundary. They cover repeated
resolution, changed and unchanged claims, concurrent provisioning, rejected
tokens causing no writes, missing email, and access-control bypass.

## Exchange codes

File: `packages/payload-supabase-auth/tests/exchangeCode.test.ts`

The five exchange tests verify digest-only storage, 256-bit opaque codes,
expiry, single use, unknown-code rejection, concurrent consumption, TTL
validation, and minimum entropy.

File: `packages/payload-supabase-auth/tests/payloadExchangeCodeStore.test.ts`

The four shared-store tests verify PostgreSQL record mapping, numeric user-ID
preservation, delete-winner semantics, missing records, custom collection
names, and expired-record cleanup.

## Payload session exchange

File: `packages/payload-supabase-auth/tests/payloadSession.test.ts`

The three session tests verify hardened Payload-compatible cookie
serialization, Payload JWT signing, expired-session pruning, session-ID
persistence, and operation when Payload sessions are disabled.

File: `packages/payload-supabase-auth/tests/exchangeEndpoint.test.ts`

The two endpoint tests verify that a missing or disallowed request origin is
rejected, missing codes fail before storage access, generic errors are
returned, and responses disable caching.

File: `packages/payload-supabase-auth/tests/exchangeCodeEndpoint.test.ts`

The three issuance-endpoint tests verify exact-origin enforcement and reject
anonymous users, other authentication strategies, and users from another auth
collection before storage is touched.

## Admin login exchange

File: `packages/payload-supabase-auth/tests/createAdminSession.test.ts`

The three client-flow tests verify password authentication against Supabase,
bearer-authenticated code issuance, Payload cookie exchange, generic credential
errors, and stopping before exchange when code issuance fails.

## Running checks

From the repository root:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter dev exec tsc --noEmit
```

`pnpm test` runs every workspace test script, including the development
application's integration and browser tests. Those broader tests may require a
configured PostgreSQL database and Playwright browser dependencies.

The dev integration suite contains eight live cases using PostgreSQL and a
dedicated Supabase test user. It loads credentials from the gitignored
`apps/dev/.env.test.local`. It verifies atomic concurrent exchange-code
consumption, expired-row cleanup, successful exchange into an authenticating
Payload cookie, replay rejection, and Payload logout/session revocation, then
removes its test data afterward.

The five Playwright checks include a live Supabase email/password login through
the package panel and verification that the resulting Payload session reaches
the admin dashboard.

The Playwright smoke suite contains four browser checks covering the Payload
admin dashboard, user list, user creation view, and development frontend. Its
helpers clean up both test data and their Payload database connection.

## Coverage boundaries

The current suite does not perform live remote JWKS fetching or database-backed
end-to-end bearer authentication. It does not cover adapter-specific concurrent
provisioning behavior, UI-specific Supabase login flows, or admin-page
customization owned by consuming applications.

See [the verification guide](docs/verification.md) for complementary live
PostgreSQL and Supabase checks.
