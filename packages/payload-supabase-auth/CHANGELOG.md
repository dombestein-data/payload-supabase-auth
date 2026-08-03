# @dombestein-data/payload-supabase-auth

## 1.0.0

### Major Changes

- d211f11: Release the first production-ready API. Add verified Supabase bearer
  authentication, linked-user provisioning and claim synchronization, shared
  single-use exchange codes, browser session issuance, Payload-compatible session
  cookies, and complete package documentation and release metadata.
  Include an opt-in Supabase email/password panel on Payload's admin login page,
  with immutable public configuration and visible setup diagnostics.
  Make Supabase authoritative for credentials, enforce adaptive MFA for enrolled
  users, and disable Payload-local login and password recovery by default.

### Patch Changes

- cf8b756: Add a hidden Payload collection and PostgreSQL-backed store for shared,
  short-lived exchange codes. Consumption now uses an atomic conditional
  `DELETE … RETURNING` operation, preserves numeric and string user IDs, and
  supports expired-record cleanup.
