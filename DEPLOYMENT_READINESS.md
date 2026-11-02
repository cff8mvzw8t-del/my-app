# Deployment readiness — 2026-11-02

## Implementation checkpoint

Commit `a234580` was pushed to `master`. GitHub Actions run `41510938457` passed dependency installation, TypeScript checking, offline logic tests, and production build. It stopped at `actions/configure-pages` because Pages was not yet enabled. The owner subsequently confirmed selecting GitHub Actions as the Pages source. The connector cannot rerun Actions jobs (403), so this documentation update triggers a fresh deployment through the already authenticated Git push. No additional hosting connection is required. Production status must be verified after that run.

The repository now exists at `https://github.com/cff8mvzw8t-del/my-app`, with `master` as its default branch. The connector successfully read its package.json and reports push/admin access. The local initial commit matches the remote.

Added a Pages Actions workflow, `/my-app/` production base path, manifest and Home Screen fox icons, build-time asset precaching, and an explicit update prompt. Offline logic tests, TypeScript checking, and a production export with the Pages base path passed. The worker caches only public application assets and does not modify localStorage. Actual iPhone offline reopening still needs a device check. Earlier connection-state observations below are historical.

## Target

Run the existing application on one iPhone with the laptop switched off, using GitHub Pages and adding offline support. No App Store distribution, additional hosting account, or database is required for this first version.

## Verified connection and repository state

- The GitHub connector successfully authenticated as `cff8mvzw8t-del`.
- Its accessible repository list was empty at the time of checking. This does not establish that the account has no repositories; a repository may still need to be created or granted to the connection.
- The local project has a Git repository with staged source files, but no configured remote.
- No GitHub repository, commit, push, Pages site, or deployment was created during this check.

## Current architecture

- Expo / React Native Web frontend, with a static production export to `dist` through `pnpm run build:web`.
- Browser data is saved in localStorage by `deviceStorage.ts`. JSON export/import is available.
- No backend, database, account login, cloud backup, or cross-device synchronization.
- Storage is scoped to the browser and origin. A public visitor does not receive someone else's local records. Source code and bundled initial data are visible to visitors.
- No offline service worker or install manifest is currently implemented.

## Recommended deployment work

Local validation on 2026-11-02: `pnpm run typecheck` passed; `pnpm run build:web` passed and exported `dist`. These checks do not verify hosted asset paths or iPhone offline behavior.

1. Create/upload the repository and make it accessible to the GitHub connection. The chosen free GitHub Pages approach uses a public repository.
2. Verify initial data and assets are suitable for publication; exclude personal backups and credentials.
3. Add a GitHub Actions workflow: frozen pnpm install, type check, production export, upload Pages artifact, deploy Pages.
4. Configure asset URLs for the actual Pages URL, including its repository path when applicable.
5. Add a web app manifest, suitable Home Screen icons, and standalone display metadata.
6. Add versioned service-worker caching of the app shell and its local assets. Cache only this application's paths, and preserve record storage during updates.
7. Provide a controlled update flow so a new deployment does not reload during editing.
8. Verify loading, navigation, images, fonts, data persistence, and backup/import from the production URL. Test offline reopening and editing after an initial online download, followed by reconnection and an update.
9. On the iPhone, open the permanent URL in Safari and add it to the Home Screen. Transfer records with JSON backup/import if they were entered at another origin.

## Connections and permissions

- Required account: GitHub only for this deployment plan.
- Required repository access: source read/write; workflow-file write access when publishing the Actions workflow. Exact connector write capabilities have not been tested without a target repository.
- GitHub Pages settings must use GitHub Actions as the source. The workflow requires `contents: read`, `pages: write`, and `id-token: write`; these are workflow permissions, not a request for an unrestricted personal token.
- The installed GitHub connector has no exposed Pages-settings management tool. If needed, the account owner can enable Pages once in the repository settings.
- Do not paste passwords or tokens into chat. Cloudflare, Railway, and an Apple developer account are unnecessary for this stage.

## Persistence and acceptance limits

Offline caching enables loading without the network after the first successful download; it does not provide backup. Clearing website data, browser storage eviction, device loss, or changing the site origin can make local records unavailable. Retain JSON backups and decide cloud backup separately before relying on daily records. Actual iPhone offline behavior remains unverified until the implementation and device test are complete.

## References

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.expo.dev/guides/progressive-web-apps/
- https://docs.expo.dev/guides/publishing-websites/
