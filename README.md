# Task Management System

Minimal TypeScript monorepo foundation. The web application displays a placeholder, and the API exposes
`GET /health` returning `{ "status": "ok" }`.

```text
apps/
  web/                  Next.js App Router, React, MUI, Tailwind CSS
    src/app/            Root layout, providers, styles, and placeholder page
    .env.example
  api/                  NestJS REST API
    src/                Bootstrap, root module, and health controller
      common/           Global request validation and its tests
      config/           Typed environment validation and its tests
    .env.example
prisma/
  schema.prisma         PostgreSQL provider and generator only; no models
tests/e2e/
  smoke.spec.ts         Frontend/responsive and API health smoke tests
.yarn/releases/         Pinned Yarn executable
.env.example            Prisma connection example
AGENTS.md               Persistent project instructions
eslint.config.mjs       Shared lint configuration with scoped Next.js rules
package.json            Workspaces and root commands
playwright.config.ts    Isolated test servers and Chromium configuration
prisma.config.ts        Root Prisma configuration
tsconfig.base.json      Shared strict TypeScript settings
tsconfig.json           Root tooling/test TypeScript configuration
yarn.lock               Reproducible dependency resolutions
```

## Getting started

Use Node.js 24 LTS (`nvm use` if using nvm). Yarn 4 is pinned in `packageManager` and checked into `.yarn/releases`.
With Corepack available, run `corepack enable` once to provide the `yarn` command. Existing Yarn installations also
delegate to the pinned release through `.yarnrc.yml`.

```bash
yarn install --immutable
yarn test:e2e:install
yarn dev
```

The frontend runs at <http://localhost:3000>. The API health endpoint is <http://localhost:3001/health>.
`yarn dev` starts both apps with watch mode; Ctrl+C stops both.

Neither app requires a database or environment file to start at this stage. Optional local environment setup:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

The root `.env` supplies `DATABASE_URL` to Prisma CLI. Next.js reads its own `.env.local`; NestJS loads its own `.env`
through NestJS ConfigModule when run using the workspace commands. `NEXT_PUBLIC_API_URL` is reserved for future
integration and is public browser configuration. `DATABASE_URL` is intentionally blank in the example.
The API validates `NODE_ENV` and converts `PORT` to an integer between 1 and 65535 before listening.

## Root commands

| Command                               | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `yarn dev`                            | Start both applications in watch mode                    |
| `yarn dev:web` / `yarn dev:api`       | Start an individual development server                   |
| `yarn build`                          | Build both applications                                  |
| `yarn start:web` / `yarn start:api`   | Run an application's compiled build                      |
| `yarn lint`                           | Lint source and configuration with zero warnings allowed |
| `yarn typecheck`                      | Check root tooling and both applications                 |
| `yarn format` / `yarn format:check`   | Apply/check shared Prettier formatting                   |
| `yarn test`                           | Run API unit tests and Playwright smoke tests            |
| `yarn test:unit`                      | Run API configuration and validation tests               |
| `yarn test:e2e`                       | Run the Playwright smoke suite                           |
| `yarn test:e2e:ui`                    | Open the Playwright test UI                              |
| `yarn test:e2e:install`               | Install Playwright Chromium                              |
| `yarn db:validate` / `yarn db:format` | Validate/format the Prisma schema                        |
| `yarn db:generate`                    | Generate the client once models are introduced           |
| `yarn db:migrate:dev --name <name>`   | Create/apply a development migration once models exist   |
| `yarn db:migrate:deploy`              | Apply committed migrations to a configured database      |
| `yarn db:migrate:status`              | Inspect migration status of a configured database        |

## Extending the foundation

Keep routing and layouts in `apps/web/src/app`. Add `components`, `hooks`, `lib/api`, or feature directories under
`src` when their first implementation is needed. Keep browser/server boundaries explicit and introduce shared API
contracts when an actual endpoint needs a frontend consumer.

Add future NestJS domain modules under `apps/api/src/modules/<domain>` and import them in `AppModule`. Configuration
and shared infrastructure already have separate folders. All future DTO-based requests pass through the global
ValidationPipe: valid bodies become DTO instances, while invalid values and undeclared fields are rejected.
DTOs must be concrete classes with validation decorators; TypeScript interfaces alone do not provide runtime validation.

Add shared packages when two consumers need the same implementation or contract, then include `packages/*` in root
workspaces and reference them using Yarn's `workspace:*` protocol. No shared package is justified at this stage.

## Migration workflow

When domain models are approved, add them to `prisma/schema.prisma`, configure `DATABASE_URL` in the root `.env`, and
use `yarn db:migrate:dev --name <descriptive_name>` against a development PostgreSQL database. Prisma may require a
shadow database or permission to create one. Review and commit the generated SQL under `prisma/migrations`, then run
`yarn db:generate`. In a release workflow, use `yarn db:migrate:deploy` to apply committed migrations.
No migrations or database operations have been run for this foundation; schema validation does not test connectivity.

## Verification

```bash
yarn lint
yarn typecheck
yarn format:check
yarn build
yarn db:validate
yarn test
```

Stop `yarn dev` before running Playwright: Next.js permits only one development server per application directory.
Playwright owns servers on ports 3100 and 3101 and stops them after the run. Keep those ports free.
The smoke suite checks the page title, placeholder content, browser errors, horizontal overflow, and responsive
padding at widths 375, 639, 640, 641, 768, and 1440 pixels. The page uses Tailwind's 640px `sm` breakpoint;
639/640/641 cover its boundary. A separate request test verifies the API health status and JSON response.
Artifacts are written to ignored `playwright-report/` and `test-results/` directories.

## Foundation decisions

- Two private Yarn workspaces with the `node-modules` linker; no task runner or shared package is needed yet.
- TypeScript 5.9 and ESLint 9 are pinned to compatible major versions across the framework tooling.
- Next.js uses its supported Webpack mode because Turbopack's CSS worker could not bind a local port in this
  development environment, including on an elevated retry.
- Playwright uses the 1.62 release line because 1.63 was still within Yarn's package-age quarantine at setup time.
- Yarn reports upstream peer-metadata warnings from `@next/eslint-plugin-next` and Prisma's bundled Studio.
  The installed versions pass lint, type checking, builds, and Prisma schema validation.
- Prisma 7 tooling is managed at the root. The generated client belongs to the API and is ignored by Git.
  Generation is deferred until models exist; it is deliberately excluded from install/build. No migrations,
  database provisioning, seeds, or database operations are part of this setup. Health reports process liveness,
  not database readiness. Runtime adapters will be added when database access is implemented.
- MUI's App Router cache provider supports server-rendered styles. CSS layer ordering lets Tailwind utilities
  override MUI styles. System fonts avoid network dependencies during builds.
- One root ESLint config scopes Next.js rules to the frontend. Both applications extend the shared strict
  TypeScript base while retaining their own module/compiler requirements.
- No application features or production deployment configuration are included.

Setup references: [MUI CSS layers](https://mui.com/material-ui/customization/css-layers),
[NestJS CLI scripts](https://docs.nestjs.com/cli/scripts),
[Yarn install modes](https://yarnpkg.com/features/linkers), and
[Playwright test servers](https://playwright.dev/docs/test-webserver).
