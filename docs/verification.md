# Lifecycle verification

Run the deterministic verification layer first:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter dev exec tsc --noEmit
```

It covers rejection, provisioning, repeated resolution, synchronization,
no-op updates, protected fields, access override, and concurrent insert
recovery without external services.

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

Database-backed verification should confirm the unique `supabaseUserId` index,
adapter-level concurrent insert behavior, collection hooks, and Payload
validation of generated random passwords.

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

Never commit or print live tokens.

## Local-auth check

The plugin preserves Payload's local strategy. Verify that existing local users
still behave as intended, provisioned users have no known/shared password, and
password-reset behavior matches product policy. Disabling local auth should be
a separate reviewed configuration change.
