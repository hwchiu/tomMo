# 部署架構

最終部署盡量單純：Kubernetes 裡**一個 Pod**、**一顆 PersistentVolume**，不做高可用、不做多副本、不另開資料庫服務。

同一支 Go binary 同時提供網站與 API。SQLite 檔放在那顆磁碟上。

## 單體

- 一支行程聽 `:8080`（`PORT` 可改）。
- `go:embed` 把 Next.js 靜態匯出放進 binary。瀏覽器開 `/` 時由這支行程回 HTML、CSS 與 JS。沒有 Next.js server，也沒有另外的 Node 行程。
- JSON REST 在 `/api`（路徑與 `src/api`、`docs/openapi.yaml` 相同，欄位是 camelCase）。
- `GET /healthz` 回 `200 {"ok":true}`，不需要登入。liveness 與 readiness 都打這個路徑。

GitHub Pages 的展示站仍是瀏覽器裡的 mock。正式與 Kubernetes 用的映像在 build 時關掉 mock，資料改走這支 API。

## 前端怎麼接上 API

靜態匯出維持 `output: "export"`。資料層用建置旗標切換，執行時不再讀另一個位址。

| | GitHub Pages 展示 | 單體映像 |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK` | 未設定，或不是 `"0"` | 建置時設為 `0` |
| `NEXT_PUBLIC_BASE_PATH` | 未設定時是 `/tomMo-` | 建置時設成空字串，站點在 `/` |
| 資料 | `localStorage` 裡的 mock | `fetch('/api/...')`，`credentials: "include"` |

`NEXT_PUBLIC_*` 在 `next build` 時寫進靜態檔。映像的 node 階段就要設好。改這兩個變數要重新 build，不能只在 `docker run` 或 Pod 環境變數裡改。

mock 開啟時，編輯存在這個瀏覽器。mock 關閉時，同一個 `src/api` client 改打同源 `/api`，session 用 HttpOnly cookie。

## SQLite

- 檔案：`/data/app.db`。`DATA_DIR` 預設在映像裡是 `/data`；本機未設定時是 `./data`。
- 驅動是 `modernc.org/sqlite`（純 Go，`CGO_ENABLED=0`）。
- 開啟時設定 **WAL**（`journal_mode=WAL`）與 `busy_timeout`。同一個目錄會出現 `app.db-wal` 與 `app.db-shm`，三個檔都留在這顆 PV 上。
- 連線數維持 1。SQLite 這份檔同時只給一個寫入行程。
- 結構在 `internal/store/schema.sql`，以 `go:embed` 放進 binary，**行程啟動時**執行。空資料庫依 `SEED_MODE` 決定內容：`demo` 用與 `fpmctl import` 相同的程式讀取嵌入的 `data/demo/*.csv`；`none` 留下列舉、四個階段模板，以及人員「系統管理員」與「唯讀帳號」。已有資料的 `app.db` 不會被覆蓋。
- 機台總數不另存一欄。各部署只存機種的計畫數量，工廠總數是那些列的加總。

## 備份

備份就是複製這個檔，放到同一顆 PV 的子目錄，或複製到別的磁碟。

WAL 開啟時，只複製 `app.db` 會漏掉尚未 checkpoint 的頁。兩種做法：

1. **檔案複製。** 維護時把 Deployment 縮成 0（或等 Pod 停掉），再複製 `/data/app.db`、`/data/app.db-wal`、`/data/app.db-shm` 到 `/data/backups/app-YYYYMMDD.db` 那一組。三個檔一起留。
2. **`sqlite3 .backup`。** 服務可以繼續跑。用帶有 `sqlite3` 的映像掛上同一個 PVC，執行：

   ```bash
   mkdir -p /data/backups
   sqlite3 /data/app.db ".backup /data/backups/app-$(date +%Y%m%d).db"
   ```

   這條指令會做出一份一致性的單檔複本。可以用 CronJob 每天跑一次。CronJob 只讀取並寫出備份檔，主 Pod 仍是唯一的應用程式寫入者。

distroless 執行映像裡沒有 shell，也沒有 `sqlite3`。備份用上面的維護複製，或另外一支含 `sqlite3` 的 CronJob，不要把工具塞進執行映像。

還原時先停掉 Pod，用備份檔換掉 `/data/app.db`，並清掉舊的 `-wal` 與 `-shm`，再把 replicas 調回 1。

## 環境變數

| 變數 | 用途 | 預設 |
| --- | --- | --- |
| `PORT` | 聽的埠 | `8080` |
| `DATA_DIR` | SQLite 目錄，檔名固定 `app.db` | 映像 `/data`，本機 `./data` |
| `SESSION_SECRET` | session cookie 的 HMAC 金鑰 | `dev-session-secret`（正式環境要改） |
| `ADMIN_USERNAME` / `VIEWER_USERNAME` | 帳號名稱 | `admin` / `viewer` |
| `INITIAL_ADMIN_PASSWORD` / `INITIAL_VIEWER_PASSWORD`（或 `*_FILE`） | 帳號第一次建立時的密碼，見「初始密碼」 | 未設定時隨機產生並寫到 `$DATA_DIR/initial-credentials.txt` |
| `DEV_DEFAULT_PASSWORDS` | 開發用：未設定密碼時用 `admin` / `viewer` | 關 |
| `LOG_INITIAL_PASSWORDS` | 開發用：把產生的密碼印到 log | 關 |
| `SEED_MODE` | 空資料庫要灌 `demo` 或留 `none`。正式 manifest 是 `none`。行程未設定時是 `demo`，方便本機 `go run`。 | 行程 `demo`，Kubernetes `none` |

帳號用姓名對到人員目錄，不記固定 id。`SEED_MODE=demo` 時編輯者是林品均、使用者是陳浩宇。`SEED_MODE=none` 時編輯者對到「系統管理員」；有設定 `INITIAL_VIEWER_PASSWORD` 時建立使用者，對到「唯讀帳號」。viewer 密碼留空時不建立 viewer 帳號。密碼以 bcrypt 存在 `accounts`。初始密碼只在帳號第一次建立時寫入，之後不會被環境變數覆寫。人員名稱還在時，每次啟動會依目前的 `SEED_MODE` 重新對上；名稱不在目錄裡時，既有帳號維持原來的人員。較早建立、目錄裡還沒有「唯讀帳號」的資料庫，會在這次啟動補上該人員再建立帳號。

Cookie 名稱 `fpm_session`，HttpOnly、SameSite=Lax。只有在 TLS 或 `X-Forwarded-Proto: https` 時加 Secure。編輯者可寫入；使用者的非 GET API 回 `403 {"message":"使用者只能閱讀"}`。未登入回 `401 {"message":"請先登入"}`。

登入抽象成 `AuthProvider`。之後可換成 OIDC authorization code + PKCE：群組 `fpm-editors` 對應編輯者，其餘為使用者，並以 `sub` 或員工編號對上 `people.external_id`。人員的 `source` 為 `manual` 或 `external`。這段尚未實作。

## 初始密碼

第一次啟動（帳號還不存在）時，編輯者的密碼依序取自下列來源。使用者在 `SEED_MODE=demo` 時同樣處理；在 `SEED_MODE=none` 時，只有設定了密碼才會建立 viewer 帳號，留空則略過，不會產生隨機的 viewer 密碼：

1. `INITIAL_ADMIN_PASSWORD` / `INITIAL_VIEWER_PASSWORD`
2. `INITIAL_ADMIN_PASSWORD_FILE` / `INITIAL_VIEWER_PASSWORD_FILE`（掛載的 secret 檔路徑，去掉結尾換行）
3. 舊名稱 `ADMIN_PASSWORD` / `VIEWER_PASSWORD`（相容用）

只在帳號不存在時使用；帳號已存在就不會覆寫密碼，之後改 Secret 也不會改到已存的密碼。

都沒設定時，伺服器為這次會建立的帳號產生隨機密碼（192 bits），寫到 `$DATA_DIR/initial-credentials.txt`（權限 0600），log 只記錄檔案路徑，不印密碼。`SEED_MODE=none` 且 viewer 密碼留空時只會產生編輯者的密碼。只有本機開發明確設定 `LOG_INITIAL_PASSWORDS=true` 才會把產生的密碼印到 log。本機想用固定的 `admin` / `admin`、`viewer` / `viewer`，啟動時設 `DEV_DEFAULT_PASSWORDS=true`（僅限開發）。

登入頁的示範帳號提示只在 `admin` 的密碼仍是公開的 `admin` 時出現，不會顯示 Secret 或產生的密碼。

Kubernetes 安裝時用隨機值建立 Secret：

```bash
kubectl create secret generic fpm-auth \
  --from-literal=INITIAL_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=INITIAL_VIEWER_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)"
```

之後要取回初始密碼：

```bash
kubectl get secret fpm-auth -o jsonpath='{.data.INITIAL_ADMIN_PASSWORD}' | base64 -d; echo
kubectl get secret fpm-auth -o jsonpath='{.data.INITIAL_VIEWER_PASSWORD}' | base64 -d; echo
```

## Dockerfile

多階段映像在儲存庫根目錄的 `Dockerfile`：node 產出靜態檔，Go 以 `CGO_ENABLED=0` 編成單一 binary，最後放進 distroless。

```dockerfile
# Demo JSON is generated from data/demo/*.csv by the same importer the server uses.
FROM golang:1.22-bookworm AS fixture
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go run ./cmd/fpmctl fixture -out /tmp/demo.json

# Frontend static export. NEXT_PUBLIC_* is inlined at build time.
FROM node:22-bookworm AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
COPY --from=fixture /tmp/demo.json ./src/mocks/demo.json
ENV NEXT_PUBLIC_USE_MOCK=0
ENV NEXT_PUBLIC_BASE_PATH=
RUN npm run build

# Go monolith. The export replaces the placeholder in web/dist before compile.
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/out ./web/dist
ENV CGO_ENABLED=0
RUN go build -o /out/server ./cmd/server
RUN mkdir -p /data && touch /data/.keep && chown -R 65532:65532 /data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
COPY --from=build --chown=65532:65532 /data /data
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
```

```bash
docker build -t fpm .
docker run --rm -p 8080:8080 \
  -e DEV_DEFAULT_PASSWORDS=true \
  -e SESSION_SECRET=dev-session-secret \
  -v fpm-data:/data \
  fpm
```

映像以 uid 65532 執行。掛上的磁碟要讓這個 uid 可寫。

本機沒有 Docker 時，先做出給 embed 的靜態檔再跑 Go：

```bash
NEXT_PUBLIC_USE_MOCK=0 NEXT_PUBLIC_BASE_PATH= npm run build
rm -rf web/dist && cp -a out web/dist
go run ./cmd/server
```

## Kubernetes

清單在 `deploy/k8s/`。目標是一個 Pod 配一顆磁碟。

| 檔案 | 內容 |
| --- | --- |
| `pvc.yaml` | `PersistentVolumeClaim`，`accessModes: [ReadWriteOnce]`，1Gi，掛在 `/data` |
| `deployment.yaml` | `replicas: 1`，`strategy: Recreate`，讀寫 `/data/app.db`，探針打 `/healthz` |
| `service.yaml` | ClusterIP，80 → 8080 |
| `ingress.yaml` | 選擇性。只在要從叢集外用網域進來時套用 |
| `secret.example.yaml` | `INITIAL_ADMIN_PASSWORD`、`INITIAL_VIEWER_PASSWORD`、`SESSION_SECRET` 的範例；建議改用下方 `kubectl create secret` 隨機產生 |

`Recreate` 讓舊 Pod 先結束，再起新的。同一時間只有一個行程打開這個 SQLite 檔。PVC 是 `ReadWriteOnce`，跟著這一個 Pod。`fsGroup: 65532` 讓 distroless 的非 root 使用者寫得了 `app.db`。

```bash
kubectl create secret generic fpm-auth \
  --from-literal=INITIAL_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=INITIAL_VIEWER_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)"
kubectl apply -f deploy/k8s/pvc.yaml
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
# 需要對外網域時再套用
kubectl apply -f deploy/k8s/ingress.yaml
```

Secret 以隨機值建立（取回方式見「初始密碼」）。把 Deployment 的 `image: fpm:latest` 換成已推上的映像。清單沒有指定 namespace，會落到目前 context 的 namespace。
