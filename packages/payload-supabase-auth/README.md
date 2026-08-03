# @dombestein-data/payload-supabase-auth

Supabase Auth integration for Payload CMS 3. It provides verified bearer-token
authentication, optional linked-user provisioning and claim synchronization,
and secure exchange into a normal Payload session cookie.

```bash
pnpm add @dombestein-data/payload-supabase-auth
```

```ts
import { supabaseAuthPlugin } from '@dombestein-data/payload-supabase-auth'

supabaseAuthPlugin({
  admin: {
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  authCollection: 'users',
  provisionUsers: true,
  supabaseUrl: process.env.SUPABASE_URL,
  synchronizeUsers: true,
})
```

The optional `admin` block adds a Supabase email/password panel to Payload's
login page. Use only a browser-safe publishable or legacy anon key—never a
service-role key. Missing UI configuration is reported at startup and shown on
the login page.

Supabase credentials are authoritative by default: Payload-local login and
password recovery are disabled while Payload sessions and logout continue to
work. Adaptive MFA requires AAL2 only for users with a verified Supabase factor;
users without factors are not forced to enroll. Configure an explicit
`access.admin` policy before enabling provisioning.

The auth collection must have an indexed, unique `supabaseUserId` text field.
The browser session-exchange store requires Payload's PostgreSQL adapter and a
migration for the collection added by the plugin. Set
`enableExchangeCodes: false` for bearer-only use with another adapter.
See the [repository README](https://github.com/dombestein-data/payload-supabase-auth#readme)
for configuration, browser session exchange, security guidance, and migration
notes.

Use the repository's
[full integration guide](https://github.com/dombestein-data/payload-supabase-auth/blob/main/docs/integration.md)
for a production setup checklist and its
[publishing guide](https://github.com/dombestein-data/payload-supabase-auth/blob/main/docs/publish.md)
for public or private registry releases.
