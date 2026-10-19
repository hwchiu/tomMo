#!/usr/bin/env bash
# Delete only the kind cluster this repo created, and restore the previous kubectl context.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-tommo}"

usage() {
  cat <<'EOF'
用法：scripts/kind-down.sh [--cluster 名稱]

刪除這個名稱的 kind 叢集，並還原先前的 kubectl current-context。不會刪除其他叢集。
環境變數 CLUSTER_NAME 預設是 tommo。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster)
      if [[ $# -lt 2 ]]; then
        echo "缺少 --cluster 的名稱。" >&2
        exit 1
      fi
      CLUSTER_NAME="$2"
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

CONTEXT="kind-${CLUSTER_NAME}"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}"
if [[ ! -d "$RUNTIME_DIR" || ! -w "$RUNTIME_DIR" ]]; then
  RUNTIME_DIR="/tmp"
fi
PID_FILE="${RUNTIME_DIR}/fpm-kind-${CLUSTER_NAME}.port-forward.pid"
NGROK_PID_FILE="${RUNTIME_DIR}/fpm-kind-${CLUSTER_NAME}.ngrok.pid"
PREV_CONTEXT=""

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少必要工具：$1" >&2
    exit 1
  fi
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

stop_ngrok() {
  local old cmd i
  if [[ ! -f "$NGROK_PID_FILE" ]]; then
    return 0
  fi
  old="$(cat "$NGROK_PID_FILE" 2>/dev/null || true)"
  rm -f "$NGROK_PID_FILE"
  if [[ -z "$old" ]]; then
    return 0
  fi
  if ! kill -0 "$old" 2>/dev/null; then
    return 0
  fi
  cmd="$(ps -p "$old" -o command= 2>/dev/null || true)"
  case "$cmd" in
    *ngrok*) ;;
    *)
      echo "pid ${old} 不是本腳本的 ngrok，略過。" >&2
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

trap restore_context EXIT

stop_ngrok
stop_our_forward

need docker
need kind
need kubectl
if ! docker info >/dev/null 2>&1; then
  echo "Docker 沒有在跑。請先啟動 Docker。" >&2
  exit 1
fi

PREV_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if cluster_exists; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "已刪除 kind 叢集 ${CLUSTER_NAME}。"
else
  echo "kind 叢集 ${CLUSTER_NAME} 不存在。"
fi
if [[ "$PREV_CONTEXT" == "$CONTEXT" ]]; then
  PREV_CONTEXT=""
  kubectl config unset current-context >/dev/null 2>&1 || true
fi
