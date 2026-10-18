package main

import (
	"log"
	"net/http"
	"os"

	"fpm/internal/httpapi"
)

func main() {
	cfg := httpapi.Config{
		DataDir:        env("DATA_DIR", "data"),
		SessionSecret:  env("SESSION_SECRET", "dev-session-secret"),
		AdminUsername:  env("ADMIN_USERNAME", "admin"),
		AdminPassword:  env("ADMIN_PASSWORD", "admin"),
		ViewerUsername: env("VIEWER_USERNAME", "viewer"),
		ViewerPassword: env("VIEWER_PASSWORD", "viewer"),
	}
	srv, err := httpapi.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer srv.Close()
	addr := ":" + env("PORT", "8080")
	log.Printf("factory coordination listening on %s (data %s)", addr, cfg.DataDir)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
