# Security

## Trust boundary

The Supabase access token is untrusted input until verification succeeds. A
Payload user is authenticated only after:

1. The Authorization header is parsed as a strict Bearer credential.
2. The JWT signature and registered claims are verified.
3. The token has a non-empty subject.
4. Exactly one Payload user is linked to that subject.

Decoding a JWT without verification is not sufficient and is not used by this
package.

## JWT validation

The default verifier trusts keys published by the configured Supabase issuer
and restricts algorithms to `ES256` and `RS256`. It verifies:

- Signature
- Issuer
- Audience
- Expiration and other applicable registered time claims
- A non-empty string subject

Configure `supabaseUrl` for the intended project. Do not accept an issuer or
audience merely because it appears inside the token. Overriding `issuer`,
`audience`, `verifyToken`, or the JWKS resolver changes the trust boundary and
must receive equivalent validation and review.

Remote JWKS retrieval is handled by `jose`, including its key-set caching and
refresh behavior. Production deployments need outbound access to the Supabase
JWKS endpoint unless they supply a secure custom key resolver.

## User linking

The link field defaults to `supabaseUserId` and should be:

- Unique, to prevent one Supabase identity from resolving to multiple users.
- Indexed, because it is queried on each bearer-authenticated request.
- Read-only in the admin UI.
- Written only by trusted provisioning or administrative code.

The resolver still detects duplicate results and fails closed, even when the
database schema is expected to enforce uniqueness.

The resolver uses `overrideAccess: true`. This is necessary because no user is
authenticated yet, but it means the configured collection and field name are
security-sensitive configuration. The query is restricted to exact equality
against the verified subject and returns at most two documents.

## Failure behavior

Missing credentials, malformed headers, failed verification, unlinked users,
duplicate links, and resolver exceptions produce no user from the Supabase
strategy. Raw verification errors are not returned to the client by the
strategy.

This failure behavior allows another Payload strategy to run. By default the
plugin disables Payload-local login and password recovery, preventing a
Supabase-managed user from creating an independent credential path.

## MFA assurance

With `mfa.policy: 'if-enrolled'`, AAL2 is required only when Supabase reports a
verified factor. AAL1 remains valid for users without factors, so enrollment is
not forced. Enrollment lookup failures fail closed. `required` always requires
AAL2; `disabled` performs no assurance check. The check wraps the server bearer
verifier, so clients cannot bypass it by skipping the admin UI.

## Token handling

- Send access tokens only over HTTPS.
- Do not log Authorization headers or raw JWTs.
- Keep access tokens in short-lived, protected client storage appropriate to
  the application threat model.
- Do not place service-role keys in browser code. This plugin needs only the
  public project URL for JWKS verification.
- Treat a custom verifier as privileged security code.

Bearer-authenticated API requests do not persist the Supabase token. The
separate exchange flow creates a Payload JWT and cookie from a one-time opaque
code; the Supabase access token is never stored in that cookie.

## Exchange codes

Exchange codes use at least 256 bits of cryptographic entropy, and only SHA-256
digests are passed to storage. They expire after 60 seconds by default. Stores
must enforce unique digests and atomic delete-and-return consumption so
concurrent requests cannot both succeed.

The memory store is not suitable for production, clustered, serverless, or
multi-process deployments. Codes and digests should not be logged.

The PostgreSQL store uses a hidden collection with normal create, read, update,
and delete access denied. Internal operations use access override. Consumption
is a single conditional `DELETE … RETURNING` statement, so only one concurrent
caller can receive a record.

The exchange endpoint accepts codes only in a POST body. It requires an
`Origin` header that matches the request URL origin unless
`exchangeAllowedOrigins` explicitly lists trusted frontend origins. It consumes
the code before creating the session, checks that its auth collection matches,
returns generic errors, and marks every response `Cache-Control: no-store`.

The resulting cookie is HttpOnly, uses the Payload cookie prefix, and inherits
the auth collection's domain, `Secure`, `SameSite`, and token-expiration
settings. Production deployments should use HTTPS and `Secure` cookies.
Allow-list only exact origins under your control.

The code-issuance endpoint applies the same origin rules and accepts only a
user authenticated by this package's `supabase-bearer` strategy for the
configured collection. It returns the raw code once in non-cacheable JSON and
removes expired database records before issuing a new code.

## Provisioning and claim synchronization

Both lifecycle features are disabled by default. Provisioning requires a
verified non-empty email and always derives the identity link from the verified
subject, not from custom mapped data. Plugin-driven provisioning creates no
local password in the default authoritative mode.

Synchronization excludes `id`, `password`, `collection`, and the configured
identity link field. Custom claim mappers remain trusted application code.
Never derive authorization from user-editable metadata. In Supabase,
`user_metadata` can be controlled by the user; privilege-bearing fields should
come from server-controlled `app_metadata` and still be validated.

The database must enforce uniqueness on the identity link. This is also the
coordination mechanism for concurrent first-request provisioning; the strategy
re-resolves after a conflicting insert.

## Operational recommendations

- Keep Payload, `jose`, and runtime dependencies patched.
- Add an explicit `access.admin` policy; automatic provisioning must not grant
  every authenticated Supabase user Payload admin access.
- Use a non-empty, securely generated `PAYLOAD_SECRET` for Payload's remaining
  auth features.
- Alert on repeated invalid-token attempts and integrity errors at an
  application boundary where logging policy can avoid token disclosure.
- Test issuer and audience settings in each environment.
- Ensure deleted or disabled Supabase identities also lose their Payload link
  or access as required by application policy.

## Host responsibilities

Built-in claim-to-role policy, token revocation checks beyond normal JWT
validity, rate limiting, and provider-specific callback handling are outside
the package. The included admin panel supports Supabase email/password login
only. Applications must configure Payload CORS alongside
`exchangeAllowedOrigins`, protect Supabase client storage, prevent secrets from
entering logs, and choose authorization claims conservatively. Payload's
standard collection logout endpoint handles cookie clearing and session
revocation for the issued Payload session.

The admin panel accepts only a browser-safe Supabase publishable or legacy anon
key. A service-role or secret key must never be passed to `admin.publishableKey`.
Configuration is fixed in Payload code/environment and cannot be edited from
the package UI.
