# 部署架構

Factory coordination（工廠協調）以**一個 Go 行程**同時提供 JSON API 與前端靜態檔。沒有另外的 Node server。

## 單體

- `cmd/server` 聽 `:8080`，或環境變數 `PORT`。
- `/api/v1/*` 是與 `src/api/router.ts` 相同的 REST 契約，JSON 欄位為 camelCase，對齊 `src/api/types.ts`。
- 前端是 Next.js `output: "export"`。編譯進映像檔時，`web/dist` 被 `go:embed` 進同一支 binary。瀏覽器開 `/`，靜態檔與 `/login` 不需要 cookie；API 除了登入與 `/healthz` 以外都要 session。

## GitHub Pages 與 Docker 的差異

| | GitHub Pages 展示 | Docker / Kubernetes |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK` | 未設定，或不是 `"0"` | 建置時設為 `0` |
| `NEXT_PUBLIC_BASE_PATH` | 未設定時是 `/tomMo-` | 建置時設成空字串，站點在 `/` |
| 資料 | 瀏覽器裡的 mock | 伺服器上的 SQLite |

`NEXT_PUBLIC_*` 在 `next build` 時寫進靜態檔，所以 Docker 映像必須在 **node 階段**就設好這兩個變數。改 env 後要重新 build，不能只在 `docker run` 時改。

## SQLite

- 檔案：`$DATA_DIR/app.db`。未設 `DATA_DIR` 時是 `./data`。映像檔預設 `DATA_DIR=/data`。
- 驅動是 `modernc.org/sqlite`（純 Go，`CGO_ENABLED=0`）。
- 啟動時跑嵌入的 SQL migration，建立關聯表。`machine_quantities` 是真正的表（`id`, `deployment_id`, `machine_type_id`, `planned`），不是 JSON blob。陣列欄位（階段依賴、計畫的功能開關與特殊異動、修訂快照）可以用 JSON 欄。
- 產品表**沒有** `code` 欄。
- 空資料庫會灌入 `buildSeed()` 的展示資料（`internal/seed/seed.json`），再補上本機帳號。
- `POST /api/v1/session/reset`（僅編輯者）把領域資料回復成 seed，**保留帳號**。
- 寫入在交易裡整表回寫。行程重啟後變更仍在。
- SQLite 同一時間只適合一個寫入行程。Deployment 請維持 **1 replica**，PVC 使用 `ReadWriteOnce`。不要用多副本共用同一個 `app.db`。

機台總數**不存成使用者輸入的總數**。每筆部署只存各機種的計畫數量；工廠總數是該廠所有產品的 `machine_quantities.planned` 加總（負數與非有限值在加總時視為 0）。

## 驗證與帳號

`AuthProvider`：

```go
type Principal struct {
    AccountID, Username, Role, PersonID string // Role 是 "editor" 或 "viewer"
}
type AuthProvider interface {
    Login(ctx context.Context, username, password string) (Principal, error)
    PrincipalFromRequest(r *http.Request) (Principal, bool)
    SetSession(w http.ResponseWriter, p Principal)
    ClearSession(w http.ResponseWriter)
}
```

現在的實作是 `LocalAuth`：

- `accounts` 表存 bcrypt 密碼、`role`、`person_id`。
- Cookie 名稱 `fpm_session`，`HttpOnly`、`SameSite=Lax`、`Path=/`。只有在 TLS 或 `X-Forwarded-Proto: https` 時才加 `Secure`。
- Cookie 值是 `base64url(payload) + "." + hex(HMAC-SHA256(payload, SESSION_SECRET))`。payload 含 `accountId`、`username`、`role`、`personId`、`exp`（7 天）。
- `SESSION_SECRET` 預設 `dev-session-secret`。**正式環境一定要改**，否則任何人都能偽造 cookie。

啟動時若帳號不存在就建立；若環境變數密碼與現有 hash 不同，會更新 hash，讓 Kubernetes Secret 生效。

| 環境變數 | 預設 | 角色 | 人員 |
| --- | --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin` | editor 編輯者 | 林品均（`u_lin`） |
| `VIEWER_USERNAME` / `VIEWER_PASSWORD` | `viewer` / `viewer` | viewer 使用者 | 陳浩宇（`u_chen`） |

- 編輯者可以修改與核准。
- 使用者只能閱讀。非 GET 的 `/api/*` 會回 `403 {"message":"使用者只能閱讀"}`。登出例外，兩種角色都可以。
- 未登入呼叫 API 回 `401 {"message":"請先登入"}`。
- `GET /healthz` 不需登入，回 `200 {"ok":true}`。
- 登入失敗回 `401 {"message":"帳號或密碼不正確"}`。

## 規劃中的 OIDC（尚未實作）

下一個 `AuthProvider` 可以是 authorization code + PKCE：

1. 瀏覽器導向 IdP，帶 `code_challenge`。
2. Callback 用 authorization code 換 token。
3. 依 claim 的群組對應角色：`fpm-editors` → `editor`，其餘 → `viewer`。
4. 用 OIDC `sub` 或員工編號對上 `people.external_id`，帳號仍指向 `people` 的一列。
5. 人員讀取繼續走同一張 `people` 表。`source` 為 `manual`（可在這裡改）或 `external`（目錄同步，API 拒絕修改，訊息是「外部人員由目錄同步，不能在這裡修改」）。

在那之前，登入只走本機帳號。

## 怎麼跑

需要已建好的前端時，在本機：

```bash
# 產生 web/dist 之後
go run ./cmd/server
```

Docker（映像內會自己 build 前端，`NEXT_PUBLIC_USE_MOCK=0`、base path 為空）：

```bash
docker build -t fpm . && docker run --rm -p 8080:8080 -e ADMIN_PASSWORD=admin -e SESSION_SECRET=dev fpm
```

要留下 SQLite，掛一個 volume 到 `/data`：

```bash
docker run --rm -p 8080:8080 -e ADMIN_PASSWORD=admin -e SESSION_SECRET=dev -v fpm-data:/data fpm
```

映像以 distroless `nonroot`（uid 65532）執行。Kubernetes 的 PVC 要設 `fsGroup: 65532`，否則行程寫不了 `app.db`。

## Kubernetes

清單在 `deploy/k8s/`：

- `deployment.yaml`：1 replica，port 8080，`DATA_DIR=/data`，readiness / liveness 打 `/healthz`。`SESSION_SECRET`、`ADMIN_PASSWORD`、`VIEWER_PASSWORD` 來自 Secret `fpm-auth`。
- `service.yaml`：ClusterIP 80 → 8080。
- `pvc.yaml`：掛在 `/data`，給 SQLite 檔。
- `secret.example.yaml`：placeholder `change-me`，不是真正的密鑰。套用前請改掉。

```bash
kubectl apply -f deploy/k8s/secret.example.yaml
kubectl apply -f deploy/k8s/pvc.yaml -f deploy/k8s/deployment.yaml -f deploy/k8s/service.yaml
```

把 Deployment 的 `image: fpm:latest` 換成你推上去的映像。沒有指定 namespace，會落到目前 context 的 namespace。
