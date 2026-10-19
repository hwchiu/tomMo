#!/usr/bin/env bash
# Create or update a local kind cluster and deploy fpm. Safe to re-run.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-tommo}"
LOCAL_PORT="${LOCAL_PORT:-8080}"
SEED_DEMO="${SEED_DEMO:-0}"
PORT_FORWARD="${PORT_FORWARD:-0}"
IMAGE_TAG="${IMAGE_TAG:-}"

usage() {
  cat <<'EOF'
用法：scripts/kind-up.sh [--seed-demo] [--port-forward] [--cluster 名稱] [--port 埠] [--image-tag 標籤]

建立或更新 kind 叢集並部署廠務協調台。可以重複執行。
環境變數：CLUSTER_NAME（預設 tommo）、IMAGE_TAG、SEED_DEMO=1、PORT_FORWARD=1、LOCAL_PORT（預設 8080）。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed-demo) SEED_DEMO=1; shift ;;
    --port-forward) PORT_FORWARD=1; shift ;;
    --cluster)
      if [[ $# -lt 2 ]]; then
        echo "缺少 --cluster 的名稱。" >&2
        exit 1
      fi
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --port)
      if [[ $# -lt 2 ]]; then
        echo "缺少 --port 的埠號。" >&2
        exit 1
      fi
      LOCAL_PORT="$2"
      shift 2
      ;;
    --image-tag)
      if [[ $# -lt 2 ]]; then
        echo "缺少 --image-tag 的標籤。" >&2
        exit 1
      fi
      IMAGE_TAG="$2"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "未知參數：$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! "$CLUSTER_NAME" =~ ^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$ ]]; then
  echo "CLUSTER_NAME 需為小寫英數與連字號：${CLUSTER_NAME}" >&2
  exit 1
fi
if [[ ! "$LOCAL_PORT" =~ ^[0-9]+$ ]] || (( LOCAL_PORT < 1 || LOCAL_PORT > 65535 )); then
  echo "LOCAL_PORT 不是有效的埠：${LOCAL_PORT}" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTEXT="kind-${CLUSTER_NAME}"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}"
if [[ ! -d "$RUNTIME_DIR" || ! -w "$RUNTIME_DIR" ]]; then
  RUNTIME_DIR="/tmp"
fi
PID_FILE="${RUNTIME_DIR}/fpm-kind-${CLUSTER_NAME}.port-forward.pid"
LOG_FILE="${RUNTIME_DIR}/fpm-kind-${CLUSTER_NAME}.port-forward.log"
PREV_CONTEXT=""
WORK=""
LOGIN_BODY=""
SECRET_FILE=""
TEMP_FORWARD=0
BASE_PORT=""

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少必要工具：$1" >&2
    exit 1
  fi
}

k() {
  kubectl --context "$CONTEXT" -n default "$@"
}

restore_context() {
  local prev contexts
  prev="${PREV_CONTEXT:-}"
  if [[ -z "$prev" ]]; then
    return 0
  fi
  contexts="$(kubectl config get-contexts -o name 2>/dev/null || true)"
  case $'\n'"${contexts}"$'\n' in
    *$'\n'"${prev}"$'\n'*)
      kubectl config use-context "$prev" >/dev/null 2>&1 || true
      ;;
  esac
}

cluster_exists() {
  local line
  while IFS= read -r line; do
    if [[ "$line" == "$CLUSTER_NAME" ]]; then
      return 0
    fi
  done < <(kind get clusters 2>/dev/null || true)
  return 1
}

port_busy() {
  local port="$1" listeners
  if command -v ss >/dev/null 2>&1; then
    listeners="$(ss -H -ltn "sport = :${port}" 2>/dev/null || true)"
    [[ -n "$listeners" ]]
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1
}

stop_our_forward() {
  local old cmd i
  if [[ ! -f "$PID_FILE" ]]; then
    return 0
  fi
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  rm -f "$PID_FILE"
  if [[ -z "$old" ]]; then
    return 0
  fi
  if ! kill -0 "$old" 2>/dev/null; then
    return 0
  fi
  cmd="$(ps -p "$old" -o command= 2>/dev/null || true)"
  case "$cmd" in
    *port-forward*) ;;
    *)
      echo "pid ${old} 不是本腳本的 port-forward，略過。" >&2
      return 0
      ;;
  esac
  kill "$old" 2>/dev/null || true
  for ((i=0; i<25; i++)); do
    if ! kill -0 "$old" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done
  kill -9 "$old" 2>/dev/null || true
}

curl_health() {
  curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${1}/healthz"
}

wait_health() {
  local port="$1" i
  for ((i=0; i<40; i++)); do
    if curl_health "$port"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

launch_forward() {
  local port="$1" pid
  nohup kubectl --context "$CONTEXT" -n default port-forward --address 127.0.0.1 svc/fpm "${port}:80" >"$LOG_FILE" 2>&1 &
  pid=$!
  echo "$pid" > "$PID_FILE"
  disown "$pid" 2>/dev/null || true
  if ! wait_health "$port"; then
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "port-forward 到 ${port} 失敗。詳見 ${LOG_FILE}" >&2
    return 1
  fi
}

free_port() {
  local port start
  start=18080
  if (( LOCAL_PORT >= 18080 )); then
    start=$((LOCAL_PORT + 1))
  fi
  for ((port=start; port<start+50; port++)); do
    if (( port == LOCAL_PORT )); then
      continue
    fi
    if ! port_busy "$port"; then
      printf '%s' "$port"
      return 0
    fi
  done
  return 1
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  printf '%s' "$s"
}

read_secret() {
  local key="$1" raw decoded
  raw="$(k get secret fpm-auth -o "jsonpath={.data.${key}}")"
  if [[ -z "$raw" ]]; then
    echo "Secret fpm-auth 缺少 ${key}。" >&2
    return 1
  fi
  if decoded="$(printf '%s' "$raw" | base64 -d 2>/dev/null)"; then
    printf '%s' "$decoded"
    return 0
  fi
  if decoded="$(printf '%s' "$raw" | base64 -D 2>/dev/null)"; then
    printf '%s' "$decoded"
    return 0
  fi
  echo "無法解碼 Secret fpm-auth 的 ${key}。" >&2
  return 1
}

create_auth_secret() {
  local admin viewer session
  SECRET_FILE="$(mktemp)"
  chmod 600 "$SECRET_FILE"
  admin="$(openssl rand -base64 24 | tr -d '\n')"
  viewer="$(openssl rand -base64 24 | tr -d '\n')"
  session="$(openssl rand -base64 48 | tr -d '\n')"
  {
    printf 'INITIAL_ADMIN_PASSWORD=%s\n' "$admin"
    printf 'INITIAL_VIEWER_PASSWORD=%s\n' "$viewer"
    printf 'SESSION_SECRET=%s\n' "$session"
  } > "$SECRET_FILE"
  unset admin viewer session
  k create secret generic fpm-auth --from-env-file="$SECRET_FILE"
  rm -f "$SECRET_FILE"
  SECRET_FILE=""
}

verify_login() {
  local user="$1" pass="$2" body code url
  body="$(mktemp)"
  chmod 600 "$body"
  LOGIN_BODY="$body"
  printf '{"username":"%s","password":"%s"}' "$(json_escape "$user")" "$(json_escape "$pass")" > "$body"
  url="http://127.0.0.1:${BASE_PORT}/api/v1/login"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -H 'Content-Type: application/json' --data-binary @"$body" "$url" || true)"
  rm -f "$body"
  LOGIN_BODY=""
  if [[ "$code" != "200" ]]; then
    echo "登入檢查失敗：${user} 回傳 HTTP ${code}。" >&2
    return 1
  fi
  echo "登入檢查通過：${user}"
}

cleanup() {
  if [[ -n "${LOGIN_BODY:-}" ]]; then
    rm -f "$LOGIN_BODY"
  fi
  if [[ -n "${SECRET_FILE:-}" ]]; then
    rm -f "$SECRET_FILE"
  fi
  if [[ "${TEMP_FORWARD:-0}" == "1" ]]; then
    stop_our_forward
  fi
  if [[ -n "${WORK:-}" ]]; then
    rm -rf "$WORK"
  fi
  restore_context
}
trap cleanup EXIT

need docker
need kind
need kubectl
need openssl
need curl
if ! docker info >/dev/null 2>&1; then
  echo "Docker 沒有在跑。請先啟動 Docker。" >&2
  exit 1
fi

if [[ -z "$IMAGE_TAG" ]]; then
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "無法從 git 取得映像標籤。請設定 IMAGE_TAG。" >&2
    exit 1
  fi
  IMAGE_TAG="$(git -C "$ROOT" rev-parse --short HEAD)"
  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    IMAGE_TAG="${IMAGE_TAG}-dirty"
  fi
fi
if [[ ! "$IMAGE_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "IMAGE_TAG 不是合法的映像標籤：${IMAGE_TAG}" >&2
  exit 1
fi

PREV_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if cluster_exists; then
  echo "kind 叢集 ${CLUSTER_NAME} 已存在，沿用。"
else
  kind create cluster --name "$CLUSTER_NAME"
fi
restore_context

echo "建置映像 fpm:${IMAGE_TAG}"
docker build -t "fpm:${IMAGE_TAG}" "$ROOT"
kind load docker-image "fpm:${IMAGE_TAG}" --name "$CLUSTER_NAME"

if k get secret fpm-auth >/dev/null 2>&1; then
  echo "Secret fpm-auth 已存在，沿用原本的密碼。"
else
  create_auth_secret
  echo "已建立 Secret fpm-auth。密碼不會印出。"
fi

WORK="$(mktemp -d)"
cp "$ROOT/deploy/k8s/pvc.yaml" "$ROOT/deploy/k8s/service.yaml" "$ROOT/deploy/k8s/deployment.yaml" "$WORK/"
cat > "$WORK/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - pvc.yaml
  - service.yaml
  - deployment.yaml
images:
  - name: fpm
    newTag: ${IMAGE_TAG}
EOF
k apply -k "$WORK"
k rollout restart deployment/fpm
k rollout status deployment/fpm --timeout=300s

if [[ "$PORT_FORWARD" == "1" ]]; then
  stop_our_forward
  for ((n=0; n<25; n++)); do
    if ! port_busy "$LOCAL_PORT"; then
      break
    fi
    sleep 0.2
  done
  if port_busy "$LOCAL_PORT"; then
    echo "本機埠 ${LOCAL_PORT} 已被其他程式占用，略過 port-forward。" >&2
  else
    launch_forward "$LOCAL_PORT"
  fi
fi

if curl_health "$LOCAL_PORT"; then
  BASE_PORT="$LOCAL_PORT"
else
  alt="$(free_port)" || {
    echo "找不到可用的本機埠來檢查登入。" >&2
    exit 1
  }
  launch_forward "$alt"
  BASE_PORT="$alt"
  TEMP_FORWARD=1
fi

admin_pw="$(read_secret INITIAL_ADMIN_PASSWORD)"
viewer_pw="$(read_secret INITIAL_VIEWER_PASSWORD)"
if [[ "$SEED_DEMO" == "1" ]]; then
  if ! command -v go >/dev/null 2>&1; then
    echo "SEED_DEMO=1 需要本機的 Go，才能執行 fpmctl。" >&2
    exit 1
  fi
  (
    cd "$ROOT"
    FPM_PASSWORD="$admin_pw" go run ./cmd/fpmctl import --dir data/demo --base "http://127.0.0.1:${BASE_PORT}" --user admin
  )
  echo "已匯入 data/demo。"
fi

verify_login admin "$admin_pw"
verify_login viewer "$viewer_pw"
unset admin_pw viewer_pw

if [[ "$TEMP_FORWARD" == "1" ]]; then
  stop_our_forward
  TEMP_FORWARD=0
fi

echo
echo "叢集：${CLUSTER_NAME}（kubectl context：${CONTEXT}）"
echo "映像：fpm:${IMAGE_TAG}"
if curl_health "$LOCAL_PORT"; then
  echo "網址：http://127.0.0.1:${LOCAL_PORT}/"
else
  echo "服務在叢集內。轉到本機："
  echo "  kubectl --context ${CONTEXT} -n default port-forward svc/fpm ${LOCAL_PORT}:80"
  echo "網址：http://127.0.0.1:${LOCAL_PORT}/"
fi
echo "登入帳號：admin、viewer"
echo "取得密碼（此腳本不會印出密碼）："
echo "  kubectl --context ${CONTEXT} -n default get secret fpm-auth -o jsonpath='{.data.INITIAL_ADMIN_PASSWORD}' | base64 -d; echo"
echo "  kubectl --context ${CONTEXT} -n default get secret fpm-auth -o jsonpath='{.data.INITIAL_VIEWER_PASSWORD}' | base64 -d; echo"
echo "拆除這個叢集：make kind-down"
echo "  或 CLUSTER_NAME=${CLUSTER_NAME} bash scripts/kind-down.sh"
