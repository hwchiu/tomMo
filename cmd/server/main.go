package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"fpm/internal/httpapi"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	cfg := httpapi.Config{
		DataDir:        env("DATA_DIR", "data"),
		SessionSecret:  env("SESSION_SECRET", "dev-session-secret"),
		AdminUsername:  env("ADMIN_USERNAME", "admin"),
		AdminPassword:  env("ADMIN_PASSWORD", "admin"),
		ViewerUsername: env("VIEWER_USERNAME", "viewer"),
		ViewerPassword: env("VIEWER_PASSWORD", "viewer"),
		SeedMode:       env("SEED_MODE", "demo"),
		Logger:         logger,
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
