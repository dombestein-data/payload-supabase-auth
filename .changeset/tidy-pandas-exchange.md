---
'@dombestein-data/payload-supabase-auth': patch
---

Add a hidden Payload collection and PostgreSQL-backed store for shared,
short-lived exchange codes. Consumption now uses an atomic conditional
`DELETE … RETURNING` operation, preserves numeric and string user IDs, and
supports expired-record cleanup.
