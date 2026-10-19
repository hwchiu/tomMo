#!/usr/bin/env bash
# Local verification: Go race tests, Vitest, and optional Playwright.
# Re-runnable. Does not print passwords.
set -euo pipefail

if [[ -d /opt/homebrew/opt/go@1.26/bin ]]; then
  export PATH="/opt/homebrew/opt/go@1.26/bin:/opt/homebrew/bin:${PATH:-}"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_E2E="${RUN_E2E:-0}"
WITH_BUILD="${WITH_BUILD:-0}"

if [[ "$RUN_E2E" != "0" && "$RUN_E2E" != "1" ]]; then
  echo "RUN_E2E 只能是 0 或 1。" >&2
  exit 1
fi
if [[ "$WITH_BUILD" != "0" && "$WITH_BUILD" != "1" ]]; then
  echo "WITH_BUILD 只能是 0 或 1。" >&2
  exit 1
fi

on_err() {
  echo "測試沒有全部通過。" >&2
}
trap on_err ERR

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少必要工具：$1" >&2
    exit 1
  fi
}

need go
need npm
if [[ ! -d node_modules ]]; then
  echo "尚未安裝前端依賴。請先在倉庫根目錄執行 npm install。" >&2
  exit 1
fi

echo "Go：$(go version)"
echo

echo "==> Go 單元測試  go test -race ./internal/... ./cmd/..."
if [[ "$WITH_BUILD" == "1" ]]; then
  go test -race -coverprofile=coverage.out -covermode=atomic ./internal/... ./cmd/...
else
  go test -race ./internal/... ./cmd/...
fi

echo
echo "==> 前端 Vitest  make test-web"
make test-web

if [[ "$WITH_BUILD" == "1" ]]; then
  echo
  echo "==> 靜態匯出  NEXT_PUBLIC_USE_MOCK=1 npm run build"
  NEXT_PUBLIC_USE_MOCK=1 npm run build
fi

if [[ "$RUN_E2E" == "1" ]]; then
  echo
  echo "==> Playwright 端對端  make e2e"
  make e2e
else
  echo
  echo "略過端對端測試。要一併執行：RUN_E2E=1 bash scripts/test.sh"
fi

trap - ERR
echo
echo "測試通過。"
