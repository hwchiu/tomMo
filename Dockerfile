# Demo JSON is generated from data/demo/*.csv by the same importer the server uses.
FROM golang:1.26-bookworm AS fixture
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
FROM golang:1.26-bookworm AS build
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
