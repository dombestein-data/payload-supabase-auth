# Development application

This Payload application exercises the workspace version of
`@dombestein-data/payload-supabase-auth`.

It uses PostgreSQL and defines an auth-enabled `users` collection with a unique,
indexed `supabaseUserId` field. The plugin installs bearer-token authentication
for that collection.

## Setup

From the repository root:

```bash
cp apps/dev/.env.example apps/dev/.env
pnpm install
pnpm dev
```

Configure:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Payload. |
| `PAYLOAD_SECRET` | Secure secret used by Payload. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project base URL, such as `https://project-ref.supabase.co`. |

Live integration tests additionally load these values from
`.env.test.local`: `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_TEST_EMAIL`, and
`SUPABASE_TEST_PASSWORD`. Use a dedicated non-production test user. The local
file is ignored by Git.

The application is available at `http://localhost:3000`.

## Linked test user

The development config enables provisioning and email synchronization. The
first valid bearer request creates a Payload user whose `supabaseUserId` equals
the Supabase Auth user's UUID (`sub` in the access token). Later requests keep
its email aligned with the verified claim.

Then call a Payload route with:

```bash
curl \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  http://localhost:3000/api/users/me
```

A valid token from the configured project authenticates the linked Payload
user. Invalid tokens and valid tokens without a linked user remain
unauthenticated.

## Useful commands

```bash
pnpm --filter dev dev
pnpm --filter dev exec tsc --noEmit
pnpm --filter dev test:int
pnpm --filter dev test:e2e
```

The browser and integration suites may require Playwright dependencies and a
running PostgreSQL database.
