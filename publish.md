# Publishing guide

This guide covers the first and subsequent releases of
`@dombestein-data/payload-supabase-auth` to public npm, private npm, and private
GitHub Packages. Publishing is an external, irreversible action: always inspect
the exact artifact and version first.

## Important registry facts

- A package version cannot be overwritten after publication. Fixes require a
  new version.
- The current repository is configured for a public npm package through
  `publishConfig.access: public`.
- Public and private are visibility settings for a package on a registry. You
  do not publish the same name and version twice to npm as separate public and
  private packages.
- Private npm packages must be scoped and require an npm account or
  organization plan that supports private packages.
- npm publishing requires interactive two-factor authentication, a suitable
  granular token, or trusted publishing through a supported CI provider.
- Never commit `.npmrc` authentication tokens or print them in CI logs.

## Release prerequisites

Before the first public release:

1. Confirm the `@dombestein-data` npm organization exists.
2. Confirm your npm account has permission to publish under that scope.
3. Confirm the package name is available:

   ```bash
   npm view @dombestein-data/payload-supabase-auth
   ```

   A not-found response is expected before the first release. A package owned
   by someone else is a blocker.

4. Confirm `repository`, `homepage`, `bugs`, `license`, and author metadata in
   `packages/payload-supabase-auth/package.json` are correct.
5. Confirm the working tree contains only intended release changes.
6. Never publish live `.env` files, tokens, test credentials, database files,
   reports, or build caches.

## Versioning with Changesets

The package starts at `0.0.0`. The pending major changeset produces `1.0.0`.

Inspect the release plan:

```bash
pnpm changeset status
```

For later work, create one changeset per user-visible change:

```bash
pnpm changeset
```

Use:

- `patch` for compatible fixes.
- `minor` for compatible features.
- `major` for breaking API or behavior changes.

Apply pending versions and generate changelog entries:

```bash
pnpm version-packages
pnpm install --lockfile-only
```

Review and commit the version, changelog, removed changeset files, and lockfile
before publishing.

## Required release checks

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @dombestein-data/payload-supabase-auth typecheck
pnpm --filter @dombestein-data/payload-supabase-auth test
pnpm --filter @dombestein-data/payload-supabase-auth build
pnpm --filter dev exec tsc --noEmit
pnpm lint
pnpm format:check
pnpm changeset status
```

When live credentials and PostgreSQL are available, also run:

```bash
pnpm --filter dev test:int
pnpm --filter dev test:e2e
```

Inspect the package without publishing:

```bash
cd packages/payload-supabase-auth
npm pack --dry-run
cd ../..
```

The repository also provides a public-release dry run:

```bash
pnpm release:dry-run
```

The artifact must contain `LICENSE`, `README.md`, `package.json`, compiled
`dist/index.*`, compiled `dist/client.*`, and the referenced internal compiled
files. It must not contain source environment files or test credentials.

For the strongest consumer check, create a disposable project outside the
repository, install the generated tarball there, and import both package entry
points:

```ts
import { supabaseAuthPlugin } from '@dombestein-data/payload-supabase-auth'
import {
  SupabaseLogin,
  createSupabaseAdminSession,
} from '@dombestein-data/payload-supabase-auth/client'
```

## Public npm: manual publication

Authenticate without storing a token in the repository:

```bash
npm login
npm whoami
```

Then publish the already-versioned package:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth publish --access public
```

If the account requires an interactive one-time password, follow the prompt or
pass `--otp` in a private terminal. Do not place an OTP in shell history,
documentation, chat, or CI configuration.

Verify the release from a clean context:

```bash
npm view @dombestein-data/payload-supabase-auth version dist-tags --json
npm install @dombestein-data/payload-supabase-auth@1.0.0
```

After verification, create and push the corresponding Git tag if the release
process does not do this automatically.

## Public npm: existing manual GitHub workflow

`.github/workflows/release.yml` uses `workflow_dispatch`, so it starts only
when someone manually runs it while GitHub Actions are enabled.

The current workflow uses Changesets and an `NPM_TOKEN` secret:

1. Create an npm granular access token scoped only to this package or
   organization, with publish permission and the required 2FA policy.
2. Add it to the GitHub repository as the `NPM_TOKEN` Actions secret.
3. Enable GitHub Actions when ready.
4. Open **Actions → Release → Run workflow**.
5. With pending changesets, Changesets normally creates or updates a release
   pull request.
6. Review and merge the release pull request.
7. Run the manual Release workflow again if it is not triggered by your chosen
   release process. With the versioned package and no pending changesets, it
   publishes.
8. Verify the npm version and GitHub release state.

Keep repository Actions disabled until you intentionally want CI or release
workflows to run. The release workflow itself remains manual-only.

## Public npm: recommended trusted publishing upgrade

npm trusted publishing uses short-lived OIDC credentials instead of a
long-lived write token. Current npm requirements include a supported hosted CI
runner, npm CLI 11.5.1 or newer, Node 22.14 or newer, and `id-token: write` in
the workflow.

To migrate safely:

1. Publish or create the package under the correct npm scope.
2. In the package settings on npmjs.com, add a GitHub Actions trusted publisher
   for the exact repository and workflow filename.
3. Permit the intended action, normally `npm publish`.
4. Change the release job permissions to include:

   ```yaml
   permissions:
     contents: write
     id-token: write
     pull-requests: write
   ```

5. Ensure the final publish command invokes a compatible npm CLI in the
   GitHub-hosted runner.
6. Test trusted publishing before deleting `NPM_TOKEN`.
7. After it succeeds, remove or restrict long-lived publish tokens.

Do not partially switch the existing Changesets workflow without testing how
its publish command obtains credentials.

## Private npm publication

Private npm packages use `restricted` access. npm private packages require a
paid user or organization plan, and consumers must authenticate to install.

To publish this package privately instead of publicly:

```bash
pnpm --filter @dombestein-data/payload-supabase-auth publish --access restricted
```

For a permanently private fork, change package metadata to:

```json
{
  "publishConfig": {
    "access": "restricted"
  }
}
```

Review `.changeset/config.json` as well; its current default access is public.
Use private settings consistently before publishing. Do not flip visibility as
part of routine releases.

Grant package read access only to the npm users or organization teams that
need it. Use read-only granular tokens for deployment installations and keep
publish-capable credentials out of application hosting environments.

## Private GitHub Packages publication

GitHub Packages is a separate npm-compatible registry. The package scope must
match or be publishable by the target GitHub owner.

Configure the registry without embedding a token:

```ini
@dombestein-data:registry=https://npm.pkg.github.com
```

For a one-off publish, authenticate in the environment, enter the package
directory, and run:

```bash
cd packages/payload-supabase-auth
npm publish --registry https://npm.pkg.github.com --access restricted
cd ../..
```

Prefer a GitHub Actions secret or the workflow's `GITHUB_TOKEN` over placing a
token directly on the command line. `NODE_AUTH_TOKEN` should already be present
in the process environment or secret store. The publishing identity needs
package write permission. Repository and organization package policies can
further restrict visibility and access.

Do not commit an `.npmrc` containing `_authToken`. Commit only the scope-to-
registry mapping when every contributor should use that registry.

## Installing a private package

### Private npm

Configure a read-only token outside version control:

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

Then install normally:

```bash
pnpm add @dombestein-data/payload-supabase-auth
```

### GitHub Packages

Configure both the scope and an authenticated read token:

```ini
@dombestein-data:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Then use the same package-manager install command. In CI, inject the environment
variable from the platform's secret store.

## Rollback and incident handling

Published versions are immutable. If a release is broken:

1. Stop deployment of the affected version.
2. Publish a corrected patch version.
3. Move the intended dist-tag only after testing the corrected version.
4. Deprecate the broken version with a concise migration message if necessary.
5. Never attempt to reuse the broken version number.

If a credential may have leaked, revoke it immediately, audit package owners
and recent releases, rotate dependent credentials, and use trusted publishing
or narrower tokens going forward.

Official references:

- [npm public scoped packages](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package/)
- [npm private packages](https://docs.npmjs.com/creating-and-publishing-private-packages/)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Packages npm quickstart](https://docs.github.com/en/packages/quickstart)
