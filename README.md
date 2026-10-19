# 廠務協調台

P0 coordination workspace for several factories moving through the same four phases. The screen that matters most is **產品交付狀況**: each factory × product cell shows the deployment, the product team's plan, and why that cell is **延遲** or **待補**. Phase 2 itself is still named 產品建立.

The GitHub Pages build keeps an in-browser mock. The Go binary in this repo serves the same JSON API from SQLite and embeds that frontend. See [docs/deployment-architecture.md](docs/deployment-architecture.md).

## Run

GitHub Pages / local mock (base path `/tomMo-`):

```bash
go run ./cmd/fpmctl fixture -out src/mocks/demo.json
npm install
npm run dev
```

Open [http://localhost:3000/tomMo-/login/](http://localhost:3000/tomMo-/login/).

```bash
npm test
npm run lint
npm run build   # static export in out/, mock mode
```

Go monolith (app at `/`, cookie session, SQLite):

```bash
NEXT_PUBLIC_USE_MOCK=0 NEXT_PUBLIC_BASE_PATH= npm run build
rm -rf web/dist && cp -a out web/dist
DEV_DEFAULT_PASSWORDS=true go run ./cmd/server
```

Or `docker build -t fpm .` then `docker run --rm -p 8080:8080 -e DEV_DEFAULT_PASSWORDS=true -e SESSION_SECRET=dev-session-secret fpm`.

Open [http://localhost:8080/login/](http://localhost:8080/login/).

Accounts when `SEED_MODE=demo`: `admin`（編輯者，林品均）and `viewer`（使用者，陳浩宇）. Initial passwords come from `INITIAL_ADMIN_PASSWORD` / `INITIAL_VIEWER_PASSWORD` (or `*_FILE` pointing at a mounted secret file) and are used only when the account does not exist yet. If unset, random passwords are generated and written to `$DATA_DIR/initial-credentials.txt` (0600); the log only shows that path. For local dev, `DEV_DEFAULT_PASSWORDS=true` uses `admin` / `admin` and `viewer` / `viewer`; `LOG_INITIAL_PASSWORDS=true` prints generated passwords (dev only).

Kubernetes install with random secrets:

```bash
kubectl create secret generic fpm-auth \
  --from-literal=INITIAL_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=INITIAL_VIEWER_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)"
```

Retrieve them later:

```bash
kubectl get secret fpm-auth -o jsonpath='{.data.INITIAL_ADMIN_PASSWORD}' | base64 -d; echo
kubectl get secret fpm-auth -o jsonpath='{.data.INITIAL_VIEWER_PASSWORD}' | base64 -d; echo
```

See [docs/deployment-architecture.md](docs/deployment-architecture.md). `SEED_MODE=none` creates only `admin`, linked to 系統管理員.

編輯者 can create and edit, including 管理. 使用者 is read-only. The mock stores edits in `localStorage`. **重設示範資料** is editor-only, and only when the process was started with `SEED_MODE=demo`.

## 初始化資料

資料只從 CSV（或同一欄位的 xlsx）進來。`data/demo/*.csv` 是展示資料的唯一來源。伺服器啟動、`fpmctl import`、Go 測試，以及 GitHub Pages 的 mock，都走 `internal/impex` 這套匯入。

`SEED_MODE` 只在 `app.db` 還沒有資料時作用：

| 值 | 空資料庫會有什麼 |
| --- | --- |
| `demo` | 讀取嵌進 binary 的 `data/demo/*.csv`。本機 `go run` 與測試的預設。 |
| `none` | 列舉、四個階段模板，以及人員「系統管理員」。Kubernetes manifest 設這個。 |

已有資料的資料庫不會被清掉，也不會重灌。`none` 底下按「重設示範資料」會回 `400`「這個環境沒有示範資料可重設」。

帳號用姓名對人。`demo` 把 admin 對到林品均、viewer 對到陳浩宇。`none` 只建 admin，對到系統管理員。

### 本機灌入展示資料

空資料庫直接：

```bash
SEED_MODE=demo go run ./cmd/server
```

或對已經在跑、且 `SEED_MODE=none` 的服務用同一批 CSV（合併，不刪除檔案裡沒有的列）：

```bash
go build -o fpmctl ./cmd/fpmctl
./fpmctl import --dir data/demo --base http://127.0.0.1:8080 --user admin --password admin
```

`--dry-run` 只印出會建立或更新的列。格式錯誤會帶檔名與列號，此時還沒有登入。

### 準備正式資料

1. 複製 `data/templates/`。每個檔有表頭和幾列範例，欄位用名稱互相參考，不用 id。
2. 依實際人員、工廠、產品、階段、施工計畫、機台數量、議題改寫。`versions.csv`、`issues.csv`、`milestones.csv` 可以不放。
3. 先乾跑，再匯入。同一目錄可以重跑；同名的列會更新，檔案裡沒有的列會留下。

```bash
./fpmctl import --dir ./my-data --dry-run --base http://127.0.0.1:8080 --user admin --password "$ADMIN_PASSWORD"
./fpmctl import --dir ./my-data --base http://127.0.0.1:8080 --user admin --password "$ADMIN_PASSWORD"
```

也可以改給單一 xlsx，每個工作表對一個 CSV 檔名（去掉 `.csv`）：

```bash
./fpmctl import --xlsx ./my-data.xlsx --base http://127.0.0.1:8080 --user admin --password "$ADMIN_PASSWORD"
```

匯出目前資料（備份，或改完再匯回去）：

```bash
./fpmctl export --dir ./backup --base http://127.0.0.1:8080 --user admin --password "$ADMIN_PASSWORD"
```

密碼也可以放在環境變數 `FPM_PASSWORD`。

### Kubernetes

Manifest 設 `SEED_MODE=none`。第一次啟動只有系統管理員。把服務轉到本機再匯入：

```bash
kubectl -n <namespace> port-forward svc/fpm 8080:80
./fpmctl import --dir ./my-data --base http://127.0.0.1:8080 --user admin --password "$ADMIN_PASSWORD"
```

`svc/fpm` 的 80 轉到 Pod 的 8080。要灌展示資料時，把 `--dir` 換成 `data/demo`。

### 靜態展示站

Pages 與 `npm test` 用的 mock 不是另一份資料。先由同一批 CSV 產生 `src/mocks/demo.json`（這個檔不進 git）：

```bash
go run ./cmd/fpmctl fixture -out src/mocks/demo.json
```

`npm test` 會自己跑這一步。GitHub Actions 與容器映像也在 `next build` 之前產生它。

## 本地開發與測試

測試資料與正式匯入用同一套 CSV。Go 測試呼叫 `impex.LoadDemo`（嵌入的 `data/demo/*.csv`）。網頁測試先由 `fpmctl fixture` 產生 `src/mocks/demo.json`。端對端測試用暫存的 `DATA_DIR`、`SEED_MODE=none` 啟動真實的 Go binary，再以 `fpmctl import --dir data/demo` 灌入同一批 CSV，然後重啟一次讓 viewer 帳號對上陳浩宇。密碼只從 `INITIAL_ADMIN_PASSWORD` / `INITIAL_VIEWER_PASSWORD` 讀取，不會印在日誌或測試輸出。

先裝一次依賴：

```bash
npm install
```

常用指令：

| 指令 | 做什麼 |
| --- | --- |
| `make test` | Go 單元測試（含 `-race`）與前端 Vitest |
| `make test-go` | 只跑 `./internal/...` 與 `./cmd/...` |
| `make test-web` | 產生 demo fixture 後跑 Vitest |
| `make coverage` | 同上，並印出各函式覆蓋率 |
| `make e2e` | 建置嵌入前端與 binary，用 Playwright 對真實服務走一遍 |

`make e2e` 會安裝 Chromium。GitHub Actions（`.github/workflows/ci.yml`）跑 Go 測試、前端建置與 Vitest，以及 Playwright；失敗時上傳 `playwright-report`。

## Public site

`npm run build` writes a static export (`output: 'export'`) to `out/`. GitHub Actions (`.github/workflows/pages.yml`) publishes that folder on every push to `main`, and also when the workflow is run by hand. Pull requests only check that the export builds.

After the pull request is merged, the site is [https://hwchiu.github.io/tomMo-/](https://hwchiu.github.io/tomMo-/).

GitHub Pages source is **GitHub Actions**. The public site is [https://www.hwchiu.com/tomMo-/](https://www.hwchiu.com/tomMo-/). The site goes live when the workflow on `main` succeeds.

The static export calls `fetch('/api/...')` with credentials when `NEXT_PUBLIC_USE_MOCK=0`. Paths are in [docs/openapi.yaml](docs/openapi.yaml). Session is the `fpm_session` cookie, not `X-Actor-Id`.

## What you can do

| Screen | Path | What it is for |
| --- | --- | --- |
| 總覽 | `/` | Month-scale timeline of every factory, then exceptions: delivery delay reasons, overdue phases, overdue issues. Filter and group by 類別 / 區域 / 製程. |
| 產品交付狀況 | `/product-build` | Factory × product grid. Each 延遲 or 待補 cell lists its reasons, days late, and owner. Filter by reason. The route stays `/product-build`. |
| 工廠 | `/factories` | Timeline, PM name and department, machine total, ad-hoc changes, topics, deployments, issues. |
| 施工計畫 | `/factories/{id}/plans/{productId}` | Optional version plus 特殊異動 (feature override or free text). Feature-only plans set each feature on or off. |
| 問題 | `/issues` | Blockers tied to a factory, phase, or product. |
| 產品 | `/products` | Name is the identifier. No code field. Versioned or 純功能開關. |
| 能力矩陣 | `/capabilities` | Factory × product rows, features grouped by product. Grey / green / red against the baseline, adhoc badge, filters. |
| 管理 | `/admin` | People directory: 姓名 and 部門. Manual rows are editable by 編輯者. |
| 活動 / 設定 | `/activity`, `/settings` | Change history, and enumerations. 設定 is hidden from 使用者. |

Default phases, copied onto each new factory and still editable there:

1. 硬體導入 Hardware Onboarding
2. 產品建立 Product Build
3. 開發者進駐 Developer Onboarding
4. 開始營運 Operations Start

Seeded products: 運算 Compute and 儲存 Storage are versioned. 資料 Data, 開發 Developer, and 監控 Monitoring are feature-flag only: a factory plan lists each feature as enabled or disabled, and 異動功能 is whatever differs from that feature's default.

Machine counts are planned quantities per machine type (機種A, 機種B, and any type added in 設定). Each factory × product plan stores the breakdown. Screens show the computed total. There is no actual or delivered machine count. A factory page rolls the planned quantities up by type across its products.

## Rules that the screens follow

- **Exceptions first.** Missing plans, windows outside Phase 2, and open issues past the as-of date are ranked above factories that are quiet.
- **One factory, its own phases.** Templates are only a starting copy. Dates, owners, names, and extra phases belong to that factory.
- **Version is optional per product.** `VERSIONED` plans choose a release. `FEATURE_ONLY` plans set every feature on or off. The change list is the features whose planned state differs from `defaultEnabled`.
- **Versions compare numerically.** `2.10.0` is newer than `2.3.0`. A `v` prefix is ignored. Feature-flag products do not have versions.
- **Capability is the planned feature set.** A cell is on, off, or not planned yet. Versioned rows derive that from the provided version and its feature changes. A feature-only CSV row lists only the switches it decided. A switch that is left out stays unplanned, and a submitted plan with a missing switch is 功能開關未定.
- **Construction windows may overlap.** Products build in parallel. A window is flagged only when it is missing, or when it starts before or ends after that factory's Phase 2 dates. There is no overlap conflict.

The window check lives in `src/domain/windows.ts` and is covered by `src/domain/windows.test.ts`. Readiness (`src/domain/readiness.ts`) requires an approved plan and a window inside Phase 2. A versioned product also needs a provided version. A feature-flag product needs a planned state for every feature. An outside window can be submitted and approved; it just does not count as ready.

**產品交付狀況** uses a separate delay taxonomy (`src/domain/delay.ts` and `internal/domain/delay.go`). A factory's stored status (進度正常 / 有風險 / 延遲 / 已完成) is not computed from these reasons. Comparison uses the dataset as-of date. `end < asOf` is late; the as-of day itself is not late. Horizon for an unsubmitted or unapproved plan is 14 days.

| Code | 標籤 | 規則 |
| --- | --- | --- |
| `PHASE2_DATES_MISSING` | 第二階段日期未設定 | 沒有第二階段，或開始／結束日是空的。待補。負責人是階段負責人，否則廠務 PM。 |
| `PLAN_NOT_SUBMITTED` | 施工計畫未提交 | 計畫未提交，且第二階段已開始，或開始日在 14 天內。已開始算延遲，14 天內算待補。產品主責。 |
| `PLAN_NOT_APPROVED` | 計畫未核准 | 狀態是已提交（不含未提交）。時間判斷同上。產品主責。 |
| `VERSION_MISSING` | 未指定提供版本 | 有版本的產品，計畫已提出但沒有提供版本。已開始算延遲，否則待補。產品主責。 |
| `FEATURE_UNPLANNED` | 功能開關未定 | 純功能開關產品，計畫已提出但還沒為每個功能選擇開或關。時間判斷同版本。產品主責。 |
| `WINDOW_MISSING` | 施工時窗未填 | 已提交或已核准，但施工開始或結束日是空的。未提交不另列。已開始算延遲，否則待補。工廠副責，否則廠務 PM。 |
| `WINDOW_STARTS_BEFORE` | 施工時窗早於第二階段 | 施工開始早於第二階段開始。待補，不計天數。工廠副責。 |
| `WINDOW_ENDS_AFTER` | 施工時窗晚於第二階段 | 施工結束晚於第二階段結束。待補，不計天數。工廠副責。 |
| `CONSTRUCTION_OVERDUE` | 已過預計完工日尚未完成 | 施工結束早於基準日，部署還不是已驗收。延遲。工廠副責。 |
| `ISSUE_OVERDUE` | 有逾期未解問題 | 未結案（待處理、處理中、受阻）且到期日早於基準日。沒指定產品的問題計入該廠每一格。延遲，取最長天數。問題負責人。 |

## Layout

```text
src/domain     pure TypeScript: types, semver, windows, readiness, feature baseline
src/mocks      demo fixture generated from data/demo/*.csv
data/demo      the only demo dataset (CSV)
data/templates example CSV headers and rows
src/api        client, in-memory router, and view models shaped like the Go JSON
src/components screens
src/app        App Router pages
docs/openapi.yaml
```

`src/api/client.ts` is the only network seam. Pages never import fixtures. Mutations bump a revision counter so every open query refetches.

## Go contract

[docs/openapi.yaml](docs/openapi.yaml) is the request and response contract: factories, phases, milestones, issues, products, deployments, plans, feature diff, activity, and enumerations.

Plan and product-build payloads include `windowState` (`MISSING` | `INSIDE` | `OUTSIDE`) and `windowReasons`. Allowed reasons are only:

- `MISSING_DATES`
- `MISSING_PHASE`
- `STARTS_BEFORE_PHASE`
- `ENDS_AFTER_PHASE`

Do not add an overlap reason. Two products whose windows share days are both `INSIDE` when each window sits inside Phase 2.

Errors are `{ "message": "..." }` with an HTTP status. The mock uses 404 for unknown resources and 503 for the header's failure preview.

## Data model

```mermaid
erDiagram
  ENUMERATION ||--o{ FACTORY : classifies
  PERSON ||--o{ FACTORY : "PM"
  FACTORY ||--|{ PHASE : owns
  PHASE ||--o{ MILESTONE : contains
  PHASE ||--o{ PHASE : dependsOn
  PRODUCT ||--o{ PLATFORM_VERSION : "releases when versioned"
  PRODUCT ||--|{ FEATURE : defines
  PLATFORM_VERSION ||--o{ VERSION_FEATURE : supports
  FEATURE ||--o{ VERSION_FEATURE : supportedBy
  FACTORY ||--|{ DEPLOYMENT : hosts
  PRODUCT ||--|{ DEPLOYMENT : deployedAs
  DEPLOYMENT ||--o{ FEATURE_CONFIGURATION : desiredVsActual
  DEPLOYMENT ||--o{ DEPLOYMENT_PHASE_LINK : introducedIn
  FACTORY ||--|{ PLATFORM_FACTORY_PLAN : plans
  PRODUCT ||--|{ PLATFORM_FACTORY_PLAN : plans
  PLATFORM_FACTORY_PLAN ||--|{ PLAN_REVISION : history
  FACTORY ||--o{ ISSUE : tracks
  PERSON ||--o{ ACTIVITY : writes
  ACCOUNT ||--|| PERSON : "login"
```

`PLATFORM_FACTORY_PLAN` is the per-factory submission: construction window, status `NOT_SUBMITTED` | `SUBMITTED` | `APPROVED`, and either a provided version or a full feature set. `PLAN_REVISION` keeps each draft, submit, and approval. A factory deployment may set a secondary owner. Planned machine quantities live on that deployment, one number per machine type, and are edited with the plan. The total is the sum. `PRODUCT.mode` is `VERSIONED` or `FEATURE_ONLY`. Feature-flag plans store `plannedFeatures`; 異動功能 is computed against each feature's `defaultEnabled`.

## Frontend options

Ship one Go binary and one Kubernetes Pod. The Next.js app stays a static export (`output: 'export'`). There is no Next.js server. `go:embed` serves that export, and the same process serves the JSON API under `/api`. SQLite (`modernc.org/sqlite`, WAL) is the database, at `/data/app.db` on a single ReadWriteOnce volume. The Deployment is `replicas: 1` with `strategy: Recreate`. Details, backup, and the manifests are in [docs/deployment-architecture.md](docs/deployment-architecture.md) and `deploy/k8s/`.

The data layer switches with a build flag:

- GitHub Pages leaves `NEXT_PUBLIC_USE_MOCK` unset, so the browser keeps the mock in `localStorage` and the site stays under `/tomMo-`.
- The container image sets `NEXT_PUBLIC_USE_MOCK=0` and an empty `NEXT_PUBLIC_BASE_PATH`. The same client then calls `fetch('/api/...')` with the session cookie.

Filters and the capability matrix still run in the browser. The API is the source of truth for the deployed site. Window checks, feature baseline, and machine totals live in Go as well as TypeScript, with the same cases (`2.10` vs `2.3`, a feature turned on against a default of off, a missing window, a window past Phase 2, two overlapping windows that are both inside).
