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

This failure behavior allows another Payload strategy to run. The plugin does
not disable Payload's local authentication strategy. Applications that retain
local auth must secure and monitor that path independently.

## Token handling

- Send access tokens only over HTTPS.
- Do not log Authorization headers or raw JWTs.
- Keep access tokens in short-lived, protected client storage appropriate to
  the application threat model.
- Do not place service-role keys in browser code. This plugin needs only the
  public project URL for JWKS verification.
- Treat a custom verifier as privileged security code.

The current implementation authenticates each request directly from the
Supabase bearer token. It does not create a Payload cookie or persist the token.

## Exchange codes

Exchange codes use at least 256 bits of cryptographic entropy, and only SHA-256
digests are passed to storage. They expire after 60 seconds by default. Stores
must enforce unique digests and atomic delete-and-return consumption so
concurrent requests cannot both succeed.

The memory store is not suitable for production, clustered, serverless, or
multi-process deployments. Codes and digests should not be logged. No endpoint
or cookie is issued yet, so CSRF, cookie attributes, redirect validation, and
session fixation remain responsibilities of the future HTTP layer.

## Provisioning and claim synchronization

Both lifecycle features are disabled by default. Provisioning requires a
verified non-empty email and always derives the identity link from the verified
subject, not from custom mapped data. A cryptographically random local password
is generated and never exposed.

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
- Use a non-empty, securely generated `PAYLOAD_SECRET` for Payload's remaining
  auth features.
- Alert on repeated invalid-token attempts and integrity errors at an
  application boundary where logging policy can avoid token disclosure.
- Test issuer and audience settings in each environment.
- Ensure deleted or disabled Supabase identities also lose their Payload link
  or access as required by application policy.

## Not implemented

Built-in claim-to-role policy, token revocation checks beyond normal JWT
validity, HTTP session-cookie exchange, CSRF protections for future cookie
flows, and admin SSO are outside the current slice. These require their own
security review before release.
