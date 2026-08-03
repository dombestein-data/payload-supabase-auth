# Agent and contributor guide

This file is the operating guide for humans and coding agents working in the
`payload-supabase-auth` repository. Read it before changing authentication,
session exchange, package metadata, migrations, or release automation.

## Project purpose

`@dombestein-data/payload-supabase-auth` connects Supabase Auth identities to a
Payload CMS 3 auth collection. It provides:

- Strict Supabase bearer-token extraction and JWT verification.
- Subject-to-Payload-user resolution.
- Opt-in linked-user provisioning.
- Opt-in mapped-claim synchronization.
- Short-lived, single-use exchange codes stored through Payload PostgreSQL.
- Payload-compatible JWT and HttpOnly session-cookie creation.
- An opt-in Supabase email/password panel on Payload's admin login page.
- Supabase-authoritative credentials with Payload-local login/recovery disabled
  by default, while Payload session logout remains supported.
- Adaptive Supabase MFA enforcement for enrolled users.

The repository is a pnpm monorepo. The public library is under
`packages/payload-supabase-auth`; `apps/dev` is the integration fixture and
reference Payload application.

## Supported runtime

- Node.js 20.9 or newer.
- Payload `^3.87.0`.
- React 19 for the optional client entry.
- PostgreSQL for exchange-code storage and Payload cookie-session exchange.
- Any Payload adapter for bearer-only mode with `enableExchangeCodes: false`.

Do not claim the full exchange flow is adapter-agnostic. Do not claim support
for Payload 4 until it has been deliberately tested and peer ranges updated.

## Repository map

```text
.
├── packages/payload-supabase-auth/
│   ├── src/
│   │   ├── admin/       Admin login component and browser exchange helper
│   │   ├── endpoints/   Exchange-code issuance and session exchange routes
│   │   ├── exchange/    Codes, PostgreSQL store, JWT session, cookie helpers
│   │   ├── strategy/    Payload Supabase bearer strategy
│   │   ├── token/       Header extraction and JOSE verification
│   │   ├── users/       Resolution, provisioning, mapping, synchronization
│   │   ├── client.ts    Client-only public export
│   │   ├── index.ts     Server-safe primary public export
│   │   ├── plugin.ts    Payload configuration transformer
│   │   └── types.ts     Public plugin options
│   └── tests/           Deterministic unit and stateful boundary tests
├── apps/dev/            Real Payload, PostgreSQL, Supabase, and browser fixture
├── docs/                All implementation, release, and test documentation
├── agents.md            Repository operating rules for contributors and agents
├── LICENSE              Repository license
└── README.md            Public project entry point
```

## Authentication method

1. Read exactly one bearer credential from `Authorization`.
2. Verify it with Supabase JWKS using allowed algorithms, issuer, audience,
   registered time claims, and a non-empty subject.
3. Find exactly one Payload user whose link field equals the subject.
4. Optionally provision a missing linked user.
5. Optionally synchronize changed mapped fields.
6. Return the user annotated for Payload's authentication pipeline.

All failures at this strategy boundary fail closed as `{ user: null }`, allowing
Payload to try another configured strategy. Never authenticate based on
unverified claims.

## Browser session method

1. A browser obtains a Supabase user access token.
2. It calls the authenticated code-issuance endpoint with that bearer token.
3. Payload verifies the origin, strategy, auth collection, and user.
4. The server generates a high-entropy code and stores only its SHA-256 digest.
5. The browser submits the raw code to the exchange endpoint.
6. PostgreSQL atomically deletes and returns one valid record.
7. Payload creates a normal session ID/JWT and returns its HttpOnly cookie.
8. Payload's standard logout endpoint clears and revokes that session.

Codes must remain short-lived, single-use, non-cacheable, and absent from URLs
and logs. Consumption must remain atomic across application instances.

## Admin login method

The client component is exported separately from
`@dombestein-data/payload-supabase-auth/client` to preserve a server-safe main
entry. It sends email/password directly to Supabase Auth, holds the access token
in memory, and performs the code exchange. It never receives a service-role
key.

The plugin appends the component through Payload's `beforeLogin` configuration
and preserves existing components. It disables Payload-local login and password
recovery using object-form `disableLocalStrategy`, then explicitly retains JWT
cookie authentication and standard logout/session-ID revocation. Adaptive MFA
is enforced in both the panel and server verifier.

Missing admin configuration must remain visible both in the server console and
on the login page. Do not add runtime-editable secret or environment settings.

## Security invariants

- Never accept `none`, symmetric, or unexpected JWT algorithms.
- Never trust a token without signature, issuer, audience, expiry, and subject
  validation.
- Never log access tokens, exchange codes, cookies, Authorization headers,
  passwords, service-role keys, or test credentials.
- Never serialize a Supabase access token into the Payload cookie.
- Never store raw exchange codes.
- Never allow two consumers to redeem one code.
- Never map authorization from user-editable metadata without an explicit,
  documented policy.
- Never let claim mapping overwrite IDs, passwords, collection markers, or the
  Supabase identity link.
- Keep the identity link indexed and database-unique.
- Keep exchange origins exact; do not add wildcard credentialed origins.
- Keep the package UI limited to browser-safe public configuration.
- Preserve other Payload strategies and incoming configuration.

Any change that weakens an invariant requires explicit security review, new
negative tests, and updated security documentation.

## Environment and secrets

The dev fixture uses:

- `DATABASE_URL`
- `PAYLOAD_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_TEST_EMAIL`
- `SUPABASE_TEST_PASSWORD`
- `SUPABASE_ADMIN_EMAILS` (server-side comma-separated admin allowlist)

Real values belong in ignored local files or secret stores. Examples may contain
placeholders only. Use a dedicated non-production Supabase project and user for
live tests. Test cleanup must remove linked Payload users and exchange records.

## Public API rules

The primary `.` export is server-safe. The `./client` export may depend on React
and browser behavior. Do not export the React component from the primary entry.

Treat exported functions, option names, defaults, endpoint paths, collection
slugs, strategy names, and error/failure behavior as public API. Add a Changeset
for user-visible changes. Breaking changes require a major release.

When adding an option:

1. Add its public type and documentation.
2. Preserve existing defaults unless intentionally breaking.
3. Add plugin and behavior tests.
4. Update README, integration guide, architecture, overview, security, and test
   documentation where relevant.
5. Verify the packed declarations expose the intended type.

## Development commands

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Deterministic gates:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter dev exec tsc --noEmit
pnpm lint
pnpm format:check
```

Live gates:

```bash
docker compose -f apps/dev/docker-compose.yml up -d
pnpm --filter dev test:int
pnpm --filter dev test:e2e
```

Package gate:

```bash
cd packages/payload-supabase-auth
npm pack --dry-run
```

See `docs/verification.md` for environment setup and expected coverage.

## Testing requirements

Add deterministic tests for every branch that can affect authentication or
session creation. Tests should cover successful behavior, malformed input,
wrong identity/collection/origin, replay, expiry, and concurrent operations as
applicable.

Keep package unit tests independent of real networks and databases. Put actual
PostgreSQL/Supabase behavior in `apps/dev/tests/int` and browser behavior in
`apps/dev/tests/e2e`. Live tests must use non-production identities and clean up
after themselves.

A change is not complete until relevant typechecks, tests, build, lint, format,
and package-artifact inspection pass.

## Database and migration requirements

The plugin adds a collection to Payload configuration but does not deploy
production schema changes. Consumer projects must generate, review, commit, and
apply their own Payload migration after installing/configuring the plugin.

Never silently drop or rewrite consumer auth data. Migration documentation must
call out backups, existing-user backfills, unique-index conflicts, rollout
order, and rollback consequences.

## Documentation requirements

Keep these documents aligned:

- `README.md`: public overview and API reference.
- `docs/README.md`: documentation index.
- `docs/integration.md`: portable consumer implementation.
- `docs/architecture.md`: internal composition and sequences.
- `docs/security.md`: threats, invariants, and host responsibilities.
- `docs/token-exchange.md`: exchange protocol details.
- `docs/overview.md`: plain-language system map.
- `docs/verification.md` and `docs/testing.md`: executable verification status.
- `packages/payload-supabase-auth/README.md`: concise npm artifact guidance.

Do not document planned behavior as implemented. Update test counts only after
the corresponding suite passes.

## Release rules

Publishing is never an implicit consequence of implementing or committing a
change. It requires explicit authorization, a clean reviewed release commit,
passing gates, artifact inspection, a correct Changeset version, and registry
credentials configured outside the repository.

The GitHub release workflow is manual (`workflow_dispatch`). Keep it manual
unless the maintainer explicitly chooses another release policy.

Never publish from a dirty worktree or reuse a version number. Never change
package visibility casually. Prefer npm trusted publishing when the workflow
has been deliberately configured and tested.

## Working-tree discipline

Preserve unrelated user changes. Inspect before editing, use focused patches,
and do not run destructive git commands. Generated Payload import maps and
migrations should be reviewed rather than blindly overwritten. Do not stage,
commit, tag, push, publish, enable Actions, or modify external registries unless
the maintainer explicitly requests that action.

## Definition of done

A package change is complete when:

1. Intended behavior and supported boundaries are explicit.
2. Security invariants still hold.
3. Public types and exports compile.
4. Deterministic tests pass.
5. Relevant PostgreSQL/Supabase/browser tests pass.
6. The dev consumer resolves the generated import map.
7. The packed artifact contains every public entry and no secrets.
8. Integration, architecture, security, verification, and release docs are
   current.
9. A suitable Changeset exists.
10. No external release action occurred without explicit approval.
