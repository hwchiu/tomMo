# 廠務協調台

P0 coordination workspace for several factories moving through the same four phases. The screen that matters most is **平台建立 (Phase 2)**: each factory × platform cell shows the deployment, the platform team's plan, and whether that plan is ready for **開發者進駐**.

This repository is the Next.js client. Persistence and authorization are expected to move to a Go JSON service. Until that service exists, `src/api` serves the same paths from typed fixtures in the browser.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000/tomMo-/](http://localhost:3000/tomMo-/). The app is served under `/tomMo-` so the same build works on GitHub Pages.

```bash
npm test    # feature baseline, construction windows, and machine totals
npm run lint
npm run build   # writes the static site to out/
```

This build is a single admin view. There is no user switcher and no per-role screen. The header can preview a slow or failed network. Edits stay in this browser’s `localStorage`. **重設示範資料** restores the seed data. `X-Actor-Id` is still sent for the future Go service; the client always uses the seeded PM.

## Public site

`npm run build` writes a static export (`output: 'export'`) to `out/`. GitHub Actions (`.github/workflows/pages.yml`) publishes that folder on every push to `main`, and also when the workflow is run by hand. Pull requests only check that the export builds.

After the pull request is merged, the site is [https://hwchiu.github.io/tomMo-/](https://hwchiu.github.io/tomMo-/).

GitHub Pages source is **GitHub Actions**. The public site is [https://www.hwchiu.com/tomMo-/](https://www.hwchiu.com/tomMo-/). The site goes live when the workflow on `main` succeeds.

Point the client at Go by setting:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

The client then `fetch`es the paths in [docs/openapi.yaml](docs/openapi.yaml) and sends `X-Actor-Id`.

## What you can do

| Screen | Path | What it is for |
| --- | --- | --- |
| 總覽 | `/` | Month-scale timeline of every factory, then exceptions: missing plans, windows outside Phase 2, overdue issues. Filter and group by 類別 / 區域 / 製程. |
| 平台建立 | `/platform-build` | Factory × platform grid. Status, version or feature-flag badge, owners, machine counts, and whether the plan is ready. |
| 工廠 | `/factories` | Per-factory month-and-week timeline, PM contact, discussion topics, plan windows, deployments, issues. |
| 施工計畫 | `/factories/{id}/plans/{platformId}` | Versioned platforms pick a release and list feature changes. Feature-flag platforms set each feature on or off; 異動功能 is the diff from the default. |
| 問題 | `/issues` | Blockers tied to a factory, phase, or platform. |
| 平台 | `/platforms` | Global platforms: 開發部門, 專案部門, 主責, and whether the platform is versioned or feature-flag only. |
| 能力矩陣 | `/capabilities` | Rows are factory × platform. Columns are features. Cells are planned on or off. |
| 活動 / 設定 | `/activity`, `/settings` | Change history, and the category / region / technology enumerations. |

Default phases, copied onto each new factory and still editable there:

1. 硬體導入 Hardware Onboarding
2. 平台建立 Platform Build
3. 開發者進駐 Developer Onboarding
4. 開始營運 Operations Start

Seeded platforms: 運算 Compute and 儲存 Storage are versioned. 資料 Data, 開發 Developer, and 監控 Monitoring are feature-flag only: a factory plan lists each feature as enabled or disabled, and 異動功能 is whatever differs from that feature's default.

Machine counts are planned quantities per machine type (機種A, 機種B, and any type added in 設定). Each factory × platform plan stores the breakdown. Screens show the computed total. There is no actual or delivered machine count. A factory page rolls the planned quantities up by type across its platforms.

## Rules that the screens follow

- **Exceptions first.** Missing plans, windows outside Phase 2, and open issues past the as-of date are ranked above factories that are quiet.
- **One factory, its own phases.** Templates are only a starting copy. Dates, owners, names, and extra phases belong to that factory.
- **Version is optional per platform.** `VERSIONED` plans choose a release. `FEATURE_ONLY` plans set every feature on or off. The change list is the features whose planned state differs from `defaultEnabled`.
- **Versions compare numerically.** `2.10.0` is newer than `2.3.0`. A `v` prefix is ignored. Feature-flag platforms do not have versions.
- **Capability is the planned feature set.** A cell is on, off, or not planned yet. Versioned rows derive that from the provided version and its feature changes.
- **Construction windows may overlap.** Platforms build in parallel. A window is flagged only when it is missing, or when it starts before or ends after that factory's Phase 2 dates. There is no overlap conflict.

The window check lives in `src/domain/windows.ts` and is covered by `src/domain/windows.test.ts`. Readiness (`src/domain/readiness.ts`) requires an approved plan and a window inside Phase 2. A versioned platform also needs a provided version. A feature-flag platform needs a planned state for every feature. An outside window can be submitted and approved; it just does not count as ready.

## Layout

```text
src/domain     pure TypeScript: types, semver, windows, readiness, feature baseline
src/mocks      demo fixtures
src/api        client, in-memory router, and view models shaped like the Go JSON
src/components screens
src/app        App Router pages
docs/openapi.yaml
```

`src/api/client.ts` is the only network seam. Pages never import fixtures. Mutations bump a revision counter so every open query refetches.

## Go contract

[docs/openapi.yaml](docs/openapi.yaml) is the request and response contract: factories, phases, milestones, issues, platforms, deployments, plans, feature diff, activity, and enumerations.

Plan and platform-build payloads include `windowState` (`MISSING` | `INSIDE` | `OUTSIDE`) and `windowReasons`. Allowed reasons are only:

- `MISSING_DATES`
- `MISSING_PHASE`
- `STARTS_BEFORE_PHASE`
- `ENDS_AFTER_PHASE`

Do not add an overlap reason. Two platforms whose windows share days are both `INSIDE` when each window sits inside Phase 2.

Errors are `{ "message": "..." }` with an HTTP status. The mock uses 404 for unknown resources and 503 for the header's failure preview.

## Data model

```mermaid
erDiagram
  ENUMERATION ||--o{ FACTORY : classifies
  USER ||--o{ FACTORY : "PM"
  FACTORY ||--|{ PHASE : owns
  PHASE ||--o{ MILESTONE : contains
  PHASE ||--o{ PHASE : dependsOn
  PLATFORM ||--o{ PLATFORM_VERSION : "releases when versioned"
  PLATFORM ||--|{ FEATURE : defines
  PLATFORM_VERSION ||--o{ VERSION_FEATURE : supports
  FEATURE ||--o{ VERSION_FEATURE : supportedBy
  FACTORY ||--|{ DEPLOYMENT : hosts
  PLATFORM ||--|{ DEPLOYMENT : deployedAs
  DEPLOYMENT ||--o{ FEATURE_CONFIGURATION : desiredVsActual
  DEPLOYMENT ||--o{ DEPLOYMENT_PHASE_LINK : introducedIn
  FACTORY ||--|{ PLATFORM_FACTORY_PLAN : plans
  PLATFORM ||--|{ PLATFORM_FACTORY_PLAN : plans
  PLATFORM_FACTORY_PLAN ||--|{ PLAN_REVISION : history
  FACTORY ||--o{ ISSUE : tracks
  USER ||--o{ ACTIVITY : writes
```

`PLATFORM_FACTORY_PLAN` is the per-factory submission: construction window, status `NOT_SUBMITTED` | `SUBMITTED` | `APPROVED`, and either a provided version or a full feature set. `PLAN_REVISION` keeps each draft, submit, and approval. A factory deployment may set a secondary owner. Planned machine quantities live on that deployment, one number per machine type, and are edited with the plan. The total is the sum. `PLATFORM.mode` is `VERSIONED` or `FEATURE_ONLY`. Feature-flag plans store `plannedFeatures`; 異動功能 is computed against each feature's `defaultEnabled`.

## Client app and a Go + htmx UI

Both can sit on this API. They are not equal fits for this product.

| | Next.js client (this repo) | Go templates + htmx |
| --- | --- | --- |
| Where it helps | The Phase 2 grid, capability matrix, timeline, and plan form recompute filters and window previews as the person types. | Settings, factory create/edit, issue status, and other forms that replace a fragment and do not keep a large client model. |
| Source of truth | Go JSON. The browser holds a view and a short-lived session copy of the demo. | Go JSON or HTML. The server renders the exception list and can share the same evaluators if they are ported. |
| Window and feature rules | Pure TypeScript modules, unit-tested here, called again when the view model is built. | The same rules should live in Go so a template cannot drift from the API. Duplicating them only in the browser will drift. |
| Cost | A second runtime (Node) and a client bundle. Dense screens stay responsive without a round trip per keystroke. | One binary and progressive HTML. The factory × platform matrix, feature diff, and multi-filter board become a lot of partial endpoints and client script anyway. |

Recommendation: keep this client for the coordination boards, and implement the OpenAPI service in Go. Port `baselineChanges`, semver compare, and `evaluateConstructionWindow` into Go and test them there with the same cases (`2.10` vs `2.3`, a feature turned on against a default of off, missing window, window past Phase 2, two overlapping windows that are both inside). Use htmx later for simple form pages if a server-rendered slice is useful; do not split the Phase 2 grid across two UI stacks.

The mock is a stand-in, not the long-term store. Session reset and the fault switch exist so the screens can be reviewed before the Go service is up.
