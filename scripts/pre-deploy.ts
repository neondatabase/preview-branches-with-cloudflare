#!/usr/bin/env bun

/**
 * Pre-deploy hook — invoked by scripts/deploy.ts after the Neon branch and
 * its connection URIs have been provisioned, and before the Worker is
 * deployed. Receives the following env vars:
 *
 *   DATABASE_URL           — pooled connection URI for this branch
 *   DATABASE_URL_UNPOOLED  — unpooled connection URI for this branch
 *   NEON_BRANCH_ID         — Neon branch ID
 *   NEON_BRANCH_NAME       — Neon branch name
 *   DEPLOY_ENV             — "production" | "preview"
 *
 * This implementation runs Drizzle migrations against the unpooled URI.
 * Drizzle-kit issues DDL that doesn't play well with PgBouncer's transaction
 * pooling, so we connect directly.
 */

const unpooled = process.env.DATABASE_URL_UNPOOLED;

if (!unpooled) {
  console.error("DATABASE_URL_UNPOOLED is required");
  process.exit(1);
}

console.log(
  `Running drizzle-kit migrate against Neon branch ${process.env.NEON_BRANCH_NAME} (${process.env.DEPLOY_ENV})`,
);

await Bun.$`bunx drizzle-kit migrate --config=./src/lib/db/config.ts`.env({
  ...process.env,
  DATABASE_URL: unpooled,
});

export {};
