package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"fpm/internal/httpapi"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	adminPassword, err := initialPassword("INITIAL_ADMIN_PASSWORD", "ADMIN_PASSWORD")
	if err != nil {
		logger.Error("startup failed", "err", err)
		os.Exit(1)
	}
	viewerPassword, err := initialPassword("INITIAL_VIEWER_PASSWORD", "VIEWER_PASSWORD")
	if err != nil {
		logger.Error("startup failed", "err", err)
		os.Exit(1)
	}
	if truthy(os.Getenv("DEV_DEFAULT_PASSWORDS")) {
		if adminPassword == "" {
			adminPassword = "admin"
		}
		if viewerPassword == "" {
			viewerPassword = "viewer"
		}
	}
	cfg := httpapi.Config{
		DataDir:        env("DATA_DIR", "data"),
		SessionSecret:  env("SESSION_SECRET", "dev-session-secret"),
		AdminUsername:  env("ADMIN_USERNAME", "admin"),
		AdminPassword:  adminPassword,
		ViewerUsername: env("VIEWER_USERNAME", "viewer"),
		ViewerPassword: viewerPassword,
		SeedMode:       env("SEED_MODE", "demo"),
		Logger:         logger,

		LogGeneratedPasswords: truthy(os.Getenv("LOG_INITIAL_PASSWORDS")),
	}
	srv, err := httpapi.New(cfg)
	if err != nil {
		logger.Error("startup failed", "err", err)
		os.Exit(1)
	}
	defer srv.Close()
	addr := ":" + env("PORT", "8080")
	logger.Info("listening", "addr", addr, "data", cfg.DataDir, "seed", cfg.SeedMode)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := srv.Listen(ctx, addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
	logger.Info("shutdown complete")
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// initialPassword reads the bootstrap password for a new account from, in order:
// NAME, NAME_FILE (path to a mounted secret file), then the legacy variable.
// Empty means "not configured"; the server then generates a random password.
func initialPassword(name, legacy string) (string, error) {
	if v := os.Getenv(name); v != "" {
		return v, nil
	}
	if path := os.Getenv(name + "_FILE"); path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("read %s_FILE: %w", name, err)
		}
		return strings.TrimRight(string(raw), "\r\n"), nil
	}
	return os.Getenv(legacy), nil
}

func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}
