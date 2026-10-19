.PHONY: test test-go test-web test-all test-ci e2e coverage fixture web-dist kind-up kind-down

GO_TEST_PKGS := ./internal/... ./cmd/...

fixture:
	go run ./cmd/fpmctl fixture -out src/mocks/demo.json

test-go:
	go test -race $(GO_TEST_PKGS)

test-web: fixture
	npx vitest run

test: test-go test-web

test-all:
	bash scripts/test.sh

test-ci:
	WITH_BUILD=1 bash scripts/test.sh

coverage:
	go test -race -coverprofile=coverage.out -covermode=atomic $(GO_TEST_PKGS)
	go tool cover -func=coverage.out

web-dist: fixture
	NEXT_PUBLIC_USE_MOCK=0 NEXT_PUBLIC_BASE_PATH= npm run build
	rm -rf web/dist && cp -a out web/dist

e2e: web-dist
	go build -o bin/fpm ./cmd/server
	go build -o bin/fpmctl ./cmd/fpmctl
	npx playwright install chromium
	npx playwright test

kind-up:
	bash scripts/kind-up.sh

kind-down:
	bash scripts/kind-down.sh
