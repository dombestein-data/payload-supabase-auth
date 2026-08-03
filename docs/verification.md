# Authentication verification

Run the deterministic verification layer first:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter dev exec tsc --noEmit
pnpm lint
pnpm format:check
```

It covers rejection, provisioning, repeated resolution, synchronization,
no-op updates, protected fields, access override, concurrent insert recovery,
exchange endpoint validation, and Payload session creation without external
services.

## PostgreSQL verification

Start the development database:

```bash
docker compose -f apps/dev/docker-compose.yml up -d
```

Ensure `apps/dev/.env` contains `DATABASE_URL`, `PAYLOAD_SECRET`, and
ensure `apps/dev/.env.test.local` contains `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_TEST_EMAIL`, and
`SUPABASE_TEST_PASSWORD`, then run:

```bash
pnpm --filter dev test:int
```

The integration suite confirms the unique `supabaseUserId` index,
adapter-level concurrent insert behavior, collection hooks, Payload validation
of password-free authoritative provisioning, adaptive MFA enforcement, atomic
exchange-code consumption, expired-code
cleanup, authenticated code issuance, exchange into a working Payload session
cookie, replay rejection, and Payload logout/session revocation.

## Live Supabase verification

Using a non-production Supabase project:

1. Call `/api/users/me` with a real access token.
2. Confirm exactly one Payload user is created with `supabaseUserId = sub`.
3. Repeat and confirm the same user is returned.
4. Change the Supabase email, refresh the token, and confirm one synchronization
   update.
5. Repeat unchanged and confirm `updatedAt` remains unchanged.
6. Try expired, wrong-project, wrong-audience, and tampered tokens and confirm
   no writes.
7. Send concurrent first requests and confirm both resolve the same single
   Payload user.
8. Submit the access token to `/api/supabase/exchange-code`, exchange the
   returned code through `/api/supabase/exchange`, confirm the cookie
   authenticates with Payload, confirm replay is rejected, then call
   `/api/users/logout` and confirm the session is revoked.

Never commit or print live tokens.

## Browser smoke verification

With PostgreSQL running and the test environment configured:

```bash
pnpm --filter dev exec playwright install chromium
pnpm --filter dev test:e2e
```

The five checks cover Supabase-to-Payload admin sign-in, the Payload dashboard,
users list, user creation view, and development frontend.

## Package artifact verification

Build and inspect the exact npm artifact before release:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter @dombestein-data/payload-supabase-auth pack
pnpm changeset status
```

The public package must be version `1.0.0`. The tarball must contain compiled
`dist` JavaScript and declarations,
plus its package README and MIT license.

## Credential-authority and MFA checks

Verify that Payload-local login and password-recovery paths cannot authenticate
Supabase-managed users, while Payload logout still revokes the issued session.
Verify both adaptive MFA branches: users without factors may use AAL1, while
users with a verified factor must present AAL2.
