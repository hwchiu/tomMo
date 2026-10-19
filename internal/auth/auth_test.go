package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestLoginAndSession(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	lookup := func(ctx context.Context, username string) (string, string, string, string, bool, error) {
		if username != "admin" {
			return "", "", "", "", false, nil
		}
		return "acct_admin", string(hash), "editor", "per_1", true, nil
	}
	auth := NewLocal("test-secret", lookup)
	if _, err := auth.Login(context.Background(), "admin", "nope"); err == nil || err.Error() != "帳號或密碼不正確" {
		t.Fatalf("bad password %v", err)
	}
	if _, err := auth.Login(context.Background(), "nobody", "secret"); err == nil {
		t.Fatal("unknown user")
	}
	principal, err := auth.Login(context.Background(), "admin", "secret")
	if err != nil || principal.PersonID != "per_1" || principal.Role != "editor" {
		t.Fatalf("login %+v %v", principal, err)
	}

	rec := httptest.NewRecorder()
	auth.SetSession(rec, principal)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	res := rec.Result()
	defer res.Body.Close()
	for _, cookie := range res.Cookies() {
		req.AddCookie(cookie)
	}
	got, ok := auth.PrincipalFromRequest(req)
	if !ok || got.Username != "admin" || got.AccountID != "acct_admin" {
		t.Fatalf("principal %+v %v", got, ok)
	}
	if _, ok := auth.PrincipalFromRequest(httptest.NewRequest(http.MethodGet, "/", nil)); ok {
		t.Fatal("missing cookie")
	}
	req.Header.Set("Cookie", CookieName+"=not-a-token")
	if _, ok := auth.PrincipalFromRequest(req); ok {
		t.Fatal("tampered")
	}

	var roleCookie *http.Cookie
	for _, cookie := range res.Cookies() {
		if cookie.Name == RoleCookieName {
			roleCookie = cookie
		}
	}
	if roleCookie == nil || roleCookie.Value != "editor" || roleCookie.HttpOnly {
		t.Fatalf("role cookie %+v", roleCookie)
	}

	cleared := httptest.NewRecorder()
	auth.ClearSession(cleared)
	clearedCookies := cleared.Result().Cookies()
	if len(clearedCookies) != 2 {
		t.Fatalf("clear count %d", len(clearedCookies))
	}
	for _, c := range clearedCookies {
		if c.MaxAge >= 0 || c.Value != "" {
			t.Fatalf("clear %+v", c)
		}
	}
}

func TestSessionExpiryRoleAndHTTPS(t *testing.T) {
	auth := NewLocal("test-secret", func(ctx context.Context, username string) (string, string, string, string, bool, error) {
		return "", "", "", "", false, errors.New("lookup down")
	})
	if _, err := auth.Login(context.Background(), "admin", "x"); err == nil || err.Error() != "lookup down" {
		t.Fatalf("lookup %v", err)
	}
	expired := sessionPayload{AccountID: "a", Username: "admin", Role: "editor", PersonID: "p", Exp: time.Now().Add(-time.Hour).Unix()}
	if _, ok := auth.parse(tokenFor(auth, expired)); ok {
		t.Fatal("expired")
	}
	badRole := sessionPayload{AccountID: "a", Username: "admin", Role: "root", PersonID: "p", Exp: time.Now().Add(time.Hour).Unix()}
	if _, ok := auth.parse(tokenFor(auth, badRole)); ok {
		t.Fatal("bad role")
	}
	viewer := sessionPayload{AccountID: "a", Username: "viewer", Role: "viewer", PersonID: "p", Exp: time.Now().Add(time.Hour).Unix()}
	got, ok := auth.parse(tokenFor(auth, viewer))
	if !ok || got.Role != "viewer" {
		t.Fatal("viewer")
	}
	emptyID := sessionPayload{Username: "admin", Role: "editor", PersonID: "p", Exp: time.Now().Add(time.Hour).Unix()}
	if _, ok := auth.parse(tokenFor(auth, emptyID)); ok {
		t.Fatal("empty account")
	}
	if _, ok := auth.parse("not-a-token"); ok {
		t.Fatal("no signature")
	}

	plain := httptest.NewRequest(http.MethodGet, "/", nil)
	if RequestIsHTTPS(plain) {
		t.Fatal("plain")
	}
	plain.Header.Set("X-Forwarded-Proto", "https,http")
	if !RequestIsHTTPS(plain) {
		t.Fatal("forwarded")
	}
	secure := auth.WithRequest(plain)
	rec := httptest.NewRecorder()
	secure.SetSession(rec, Principal{AccountID: "a", Username: "admin", Role: "editor", PersonID: "p"})
	if !rec.Result().Cookies()[0].Secure {
		t.Fatal("secure cookie")
	}
	secure.ClearSession(rec)
}

func tokenFor(a *LocalAuth, payload sessionPayload) string {
	raw, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(raw) + "." + sign(a.secret, raw)
}
