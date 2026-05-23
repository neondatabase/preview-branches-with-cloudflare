# Preview branches with Cloudflare

> **Beta:** This is a new and novel approach that has not been fully battle-tested in production.

This example gives every Cloudflare Workers preview deployment its own isolated [Neon](https://neon.tech/?ref=github) database branch, fronted by a dedicated [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) config — created and wired up automatically on every push.

A single deploy script (`scripts/deploy.ts`) is run by [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) and drives the whole flow: it creates (or reuses) the Neon branch, provisions Hyperdrive, injects the connection strings, and deploys the Worker — for both production and previews.

## Highlights

- Per-Git-branch preview deploys, each backed by an isolated Neon branch.
- Cloudflare Hyperdrive set up automatically for every branch, including previews.

## How it works

Deploys are triggered by the [Cloudflare Workers and Pages GitHub App](https://github.com/apps/cloudflare-workers-and-pages), not by workflows in this repo. On every build, Workers Builds runs `scripts/deploy.ts`, which branches on the Git branch being built:

- Push to the default branch (`main`) → production deploy, paired with Neon's default branch.
- Push to any other branch → preview deploy, backed by a Neon branch dedicated to that Git branch and reused across commits.

The connection string reaches the Worker as `env.HYPERDRIVE` (Hyperdrive binding) and as plain `env.DATABASE_URL` (pooled) and `env.DATABASE_URL_UNPOOLED` (unpooled) values.

Hyperdrive is required here, not a nice-to-have: Neon's WebSocket driver doesn't run on Cloudflare Workers, and Neon's HTTP driver doesn't support interactive transactions. That leaves the `pg` TCP driver — and Hyperdrive is what makes TCP Postgres from a Worker fast.

There are no GitHub Actions workflows and no Neon GitHub App or `create-branch-action` — everything is handled by the one deploy script.

### Preview flow

1. Push to a non-default Git branch.
2. The Cloudflare GitHub App triggers a non-production build, which runs `scripts/deploy.ts`.
3. The script deletes any Hyperdrive config whose Neon branch no longer exists.
4. It looks up the Neon branch named `preview-<branch-slug>`, reusing it if present or creating it with a 7-day TTL.
5. It fetches the branch's pooled and unpooled connection URIs.
6. It upserts a Hyperdrive config named `preview-branches-with-cloudflare--preview--<branch-slug>` pointing at the unpooled URI.
7. It runs `wrangler versions upload --preview-alias <branch-slug>` with the Hyperdrive binding and the connection strings bundled in.
8. When the Git branch is deleted, the Neon branch expires via its TTL, and the next deploy removes the orphaned Hyperdrive config.

### Production flow

1. Push to the default Git branch (`main`).
2. The Cloudflare GitHub App triggers a production build, which runs `scripts/deploy.ts`.
3. The script deletes any Hyperdrive config whose Neon branch no longer exists.
4. It finds Neon's default branch and fetches its pooled and unpooled connection URIs.
5. It upserts a Hyperdrive config named `preview-branches-with-cloudflare--production` pointing at the unpooled URI.
6. It runs `wrangler deploy` with the Hyperdrive binding and the connection strings bundled in.

Production credentials are fetched from Neon on every deploy.

## Tech stack

- [Neon](https://neon.tech/?ref=github) — managed Postgres with database branching
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — deployment platform
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) — CI/CD, triggered by the Cloudflare GitHub App
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) — connection pooling in front of Postgres
- [node-postgres (`pg`)](https://node-postgres.com/) — Postgres client
- [Bun](https://bun.sh) — runtime and package manager

This example ships a minimal Worker that runs one sample query — it demonstrates the preview-branching and connection-injection mechanism, not application code.

### Database migrations

The repo ships a [Drizzle](https://orm.drizzle.team/) schema at [`src/lib/db/schema.ts`](src/lib/db/schema.ts) with the generated SQL under [`src/lib/db/migrations/`](src/lib/db/migrations/). Edit the schema and run `bun run db:generate` to produce a new migration; commit both. Drizzle is used here only as a schema and migrations tool — the Worker itself queries Postgres with vanilla `pg` over Hyperdrive.

### Pre-deploy hook

`scripts/deploy.ts` is project-agnostic. If a sibling [`scripts/pre-deploy.ts`](scripts/pre-deploy.ts) exists, it is invoked after the Neon branch is provisioned and before the Worker is deployed, with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH_ID`, `NEON_BRANCH_NAME`, and `DEPLOY_ENV` in its environment. This repo's hook runs `drizzle-kit migrate` against the unpooled URI, so every preview gets an isolated, fully-migrated database before the Worker version goes live. A non-zero exit fails the deploy; the Neon branch and Hyperdrive config are left intact so the next push retries cleanly. Delete `scripts/pre-deploy.ts` if you don't need it.

## Prerequisites

- A [Neon project](https://neon.tech/?ref=github) (the free tier is enough).
- A Neon API key with permission to create branches and read connection strings — see [Manage API keys](https://neon.tech/docs/manage/api-keys).
- Your Neon project ID.
- A Cloudflare account.
- The [Cloudflare Workers and Pages GitHub App](https://github.com/apps/cloudflare-workers-and-pages) installed on your fork of this repository.

You do not need to create a Cloudflare API token by hand. Workers Builds injects `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` automatically, with the scopes needed to manage Hyperdrive.

## Setup

1. Clone the repository and install dependencies (you need [Bun](https://bun.sh)):

   ```bash
   git clone https://github.com/neondatabase/preview-branches-with-cloudflare.git
   cd preview-branches-with-cloudflare
   bun install
   ```

2. Create a [Neon project](https://neon.tech/?ref=github) (the free tier is enough), choosing a region close to where your Worker will run. Note the **project ID** and create a **Neon API key** for it — see [Manage API keys](https://neon.tech/docs/manage/api-keys). The same project is used for production, previews, and local development.

3. Set `placement.region` in [`wrangler.jsonc`](wrangler.jsonc) to match your Neon project's region (e.g. `aws:us-east-1`). Keeping compute close to the database is what makes this fast.

4. In the Cloudflare dashboard, go to **Workers & Pages → Create application → Continue with GitHub** and link this repository. On the **Set up your application** step, set both:
   - **Deploy command**: `scripts/deploy.ts`
   - **Non-production branch deploy command**: `scripts/deploy.ts`

   Click **Deploy**. The first build fails — expected, the Neon variables aren't set yet. The script decides production vs. preview internally from `WORKERS_CI_BRANCH`.

5. In the Worker's settings, under **Build** (not **Variables and Secrets**), add:

   | Variable             | Type   | Required | Value                                        |
   | -------------------- | ------ | -------- | -------------------------------------------- |
   | `NEON_API_KEY`       | Secret | Yes      | The Neon API key                             |
   | `NEON_PROJECT_ID`    | Text   | Yes      | Your Neon project ID                         |
   | `GIT_DEFAULT_BRANCH` | Text   | No       | Git default branch name (defaults to `main`) |

6. Rebuild the Worker. The production deploy now succeeds. Open a branch to get a preview deployment with its own Neon branch.

## Local development

1. `cp .env.example .env`
2. In the **same Neon project** from setup, create a branch for development (e.g. `dev`).
3. Copy its **pooled** connection string into `DATABASE_URL` in `.env`.
4. Copy its **unpooled** connection string into both `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` and `DATABASE_URL_UNPOOLED` in `.env`.
5. Run the app locally:

   ```bash
   bun run dev
   ```

After changing bindings in [`wrangler.jsonc`](wrangler.jsonc), regenerate types with `bun run cf-typegen`.

Do not run `wrangler deploy` locally. A local deploy would inherit the latest Worker version's secret (typically the most recent preview's database URL) and clobber production. All deploys go through Workers Builds.

## Notes and limitations

- One Neon branch per Git branch, reused across commits. Test data created during review persists into the next preview deploy. A force-push that rewrites schema-changing commits does not rewind the database.
- Cleanup is TTL-driven. Abandoned Neon branches expire after 7 days; the TTL is refreshed on every deploy. Orphaned Hyperdrive configs are removed at the start of the next deploy — long-idle projects keep orphans until something deploys again.

## Resources

- [Neon documentation](https://neon.tech/docs)
- [Neon branching](https://neon.tech/docs/introduction/branching)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [neon-preview-deployments](https://github.com/lirbank/neon-preview-deployments) — deeper analysis of preview-deployment strategies across hosting providers
