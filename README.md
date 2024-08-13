# Preview branches with Cloudflare

This is an example project that shows you can have a Neon Preview database for every Cloudflare Pages Preview Deployment where each database has both the schema and data. The process of creating new Preview Deployments and databases is automated using GitHub Actions.

## Tech stack

This is a simple API that uses the following technologies:
- [Neon](https://neon.tech/ref=github) - Managed Postgres
- [Cloudflare Pages](https://pages.cloudflare.com/) - Deployment platform
- [GitHub Actions](https://docs.github.com/en/actions) - CI/CD pipeline
- [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) - Headless TypeScript ORM and Drizzle ORM SQL migration generator
- [Hono](https://hono.dev) - API framework
- [Bun](https://bun.sh) - Develop, test, run, and bundle JavaScript & TypeScript projects—all with Bun. Bun is an all-in-one JavaScript runtime & toolkit designed for speed, complete with a bundler, test runner, and Node.js-compatible package manager.

## Getting started

You can copy the files located at `.github/workflows/` and add them to your own project.

You will then need to set the following secrets in your repository:

- `CLOUDFLARE_API_TOKEN`: Grants you access to perform actions on your Cloudflare account via the Cloudflare API. View [Create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) 
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID, you can find it in the Cloudflare Dashboard under `Workers & Pages`.
- `NEON_API_KEY`: Your Neon API key, you can find it in your Neon account settings. View [Manage API Keys](https://neon.tech/docs/manage/api-keys)
- `DATABASE_URL`: The connection string for your production database. You can find it in your Neon project's connection details. View [Connect to Neon](https://neon.tech/docs/connect/connect-intro)
- `GH_TOKEN`: A GitHub token with access to your repository, you can create one in your GitHub account settings. You will need to give it access to the repo scope so that the deploy-preview workflow can comment on the pull request.

You will then need to set the following variables:

`NEON_PROJECT_ID`: The ID of your Neon project, you can find it in your Neon project settings.

## How it works

### Production Deployment

The `.github/workflows/production-deployment.yml` file automates the production deployment process. It is triggered on push events to the `main` branch.

The workflow consists of a single job called `deploy-production`. It includes the following steps:

1. Checks out the codebase using [`actions/checkout@v4`](https://github.com/actions/checkout/tree/v4/).
2. Sets up the Bun JavaScript runtime using [`oven-sh/setup-bun@v2`](https://github.com/oven-sh/setup-bun/tree/v2/).
3. Installs project dependencies with `bun install --frozen-lockfile`, ensuring consistent installations across different environments.
4. Runs database migrations using the command `bun run db:migrate`, utilizing the `DATABASE_URL` secret.
5. Builds the project with `bun run build`, also using the `DATABASE_URL` secret.
6. Deploys the API using the [`AdrianGonz97/refined-cf-pages-action@v1`](https://github.com/AdrianGonz97/refined-cf-pages-action/tree/v1/) action, which is a custom action for deploying to Cloudflare Pages. This step:
   - Specifies the project name as "preview-branches-with-cloudflare". You will need to adjust this value depending on your Cloudflare Pages project name.
   - Deploys the contents of the `./dist` directory.
   - Sets the deployment name as "production" and targets the `main` branch.

### Preview Deployment

The `.github/workflows/preview-deployment.yml` file automates the preview deployment process for pull requests.

The workflow consists of a single job called `deploy-preview`. It includes the following steps:

1. Checks out the codebase using [`actions/checkout@v4`](https://github.com/actions/checkout/tree/v4/).
2. Sets up the Bun JavaScript runtime using [`oven-sh/setup-bun@v2`](https://github.com/oven-sh/setup-bun/tree/v2/).
3. Installs project dependencies with `bun install --frozen-lockfile`, ensuring consistent installations across different environments.
4. Retrieves the current git branch name using the [`tj-actions/branch-names@v8`](https://github.com/tj-actions/branch-names/tree/v8/) action.
5. Creates a new Neon database branch for the preview environment using [`neondatabase/create-branch-action@v5`](https://www.github.com/neondatabase/create-branch-action/tree/v5/), which:
   - Uses the `NEON_PROJECT_ID` and `NEON_API_KEY` for authentication and configuration.
   - Names the new branch `preview/{current_branch_name}`.
6. Runs database migrations using `bun run db:migrate`, utilizing the newly created database branch URL.
7. Adds the database connection string to the `wrangler.toml` file for Cloudflare Workers configuration. This will make the database URL available as an environment variable in the Cloudflare Workers environment.
8. Builds the project with `bun run build`.
9. Deploys the preview using the [`AdrianGonz97/refined-cf-pages-action@v1`](https://github.com/AdrianGonz97/refined-cf-pages-action/tree/v1/) action, which:
   - Uses various secrets for authentication and configuration.
   - Specifies the project name as "preview-branches-with-cloudflare". You will need to adjust this value depending on your Cloudflare Pages project name.
   - Deploys the contents of the `./dist` directory.
   - Sets the deployment name and branch to the current branch name.
10. Comments on the pull request using `thollander/actions-comment-pull-request@v2`, providing:
    - The Cloudflare Pages preview URL.
    - A link to the Neon database branch in the Neon console.

### Cleanup Preview Deployments

The `.github/workflows/cleanup-preview-deployment.yml` file automates the cleanup process for preview deployments when a pull request is closed/merged. It is triggered on pull request `closed` events.

The workflow consists of a single job called `delete-preview`. It includes the following steps:

1. Deletes Cloudflare Pages preview deployments. It uses a custom shell script to interact with the Cloudflare API:
   - Retrieves the branch name associated with the closed pull request.
   - Fetches all deployments for the project and filters those matching the pull request branch.
   - Iterates through the matching deployments and deletes each one using the Cloudflare API.
   - Utilizes `curl` for API requests and `jq` for JSON parsing.
   - Uses the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` for authentication.

2. Deletes the associated Neon database branch:
   - Uses the `neondatabase/delete-branch-action@v3.1.3` action.
   - Targets the branch named `preview/{pull_request_branch_name}`.
   - Utilizes the `NEON_PROJECT_ID` and `NEON_API_KEY` for authentication and configuration.

## Setting up the project


	1.	Clone the repository:

```bash
git clone https://github.com/neondatabase/preview-branches-with-cloudflare.git
cd preview-branches-with-cloudflare
```

	2.	Install dependencies. You will need to have [Bun installed](https://bun.sh/):

```bash
bun install
```

	3.	Install Cloudflare CLI and login:

```bash
bun install -g wrangler
wrangler login
```
	4.	Create a Neon project at https://console.neon.tech

	5.	Copy environment files and set the `DATABASE_URL` secret to your project's connection string:

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
```

	6.	Run the deploy command:
```
bun run deploy
```

You will be prompted to create a new Cloudflare Pages project. Follow the instructions to create the project and deploy the API.

	7.	Add the NEON_DATABASE_URL secret to your Cloudflare Pages project settings.