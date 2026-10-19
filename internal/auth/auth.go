package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"fpm/internal/apierr"
	"golang.org/x/crypto/bcrypt"
)

// dummyHash is compared when the account does not exist so login timing does
// not reveal which usernames are registered. Cost matches production hashes.
var dummyHash = func() []byte {
	hash, err := bcrypt.GenerateFromPassword([]byte("not-a-real-password"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	return hash
}()

const (
	CookieName = "fpm_session"
	// RoleCookieName is readable by the page so the nav can show 管理 before
	// the bootstrap payload returns. It is not a credential; the session cookie
	// still decides what the API allows.
	RoleCookieName = "fpm_role"
)

// Principal is the signed-in account.
type Principal struct {
	AccountID string
	Username  string
	Role      string
	PersonID  string
}

// AuthProvider is the session boundary. LocalAuth is the current implementation.
// A future OIDC provider can satisfy the same interface.
type AuthProvider interface {
	Login(ctx context.Context, username, password string) (Principal, error)
	PrincipalFromRequest(r *http.Request) (Principal, bool)
	SetSession(w http.ResponseWriter, p Principal)
	ClearSession(w http.ResponseWriter)
}

type AccountLookup func(ctx context.Context, username string) (id, hash, role, personID string, ok bool, err error)

// LocalAuth stores bcrypt passwords and an HMAC session cookie.
type LocalAuth struct {
	secret  string
	lookup  AccountLookup
	mu      sync.Mutex
	revoked map[string]int64
}

func NewLocal(secret string, lookup AccountLookup) *LocalAuth {
	return &LocalAuth{secret: secret, lookup: lookup, revoked: map[string]int64{}}
}

func (a *LocalAuth) Login(ctx context.Context, username, password string) (Principal, error) {
	id, hash, role, personID, ok, err := a.lookup(ctx, username)
	if err != nil {
		return Principal{}, err
	}
	compare := dummyHash
	if ok && hash != "" {
		compare = []byte(hash)
	}
	mismatch := bcrypt.CompareHashAndPassword(compare, []byte(password)) != nil
	if !ok || mismatch {
		return Principal{}, apierr.New(401, "帳號或密碼不正確")
	}
	return Principal{AccountID: id, Username: username, Role: role, PersonID: personID}, nil
}

// Revoke rejects this session token until it would have expired.
func (a *LocalAuth) Revoke(token string) {
	if token == "" {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now().Unix()
	for key, exp := range a.revoked {
		if exp <= now {
			delete(a.revoked, key)
		}
	}
	a.revoked[token] = now + int64(8*24*time.Hour/time.Second)
}

func (a *LocalAuth) revokedToken(token string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	exp, ok := a.revoked[token]
	if !ok {
		return false
	}
	if exp <= time.Now().Unix() {
		delete(a.revoked, token)
		return false
	}
	return true
}

func (a *LocalAuth) PrincipalFromRequest(r *http.Request) (Principal, bool) {
	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return Principal{}, false
	}
	return a.parse(cookie.Value)
}

func (a *LocalAuth) SetSession(w http.ResponseWriter, p Principal) {
	a.writeSession(w, p, false)
}

func (a *LocalAuth) ClearSession(w http.ResponseWriter) {
	a.clearSession(w, false)
}

// WithRequest binds cookie Secure to this request's HTTPS signal.
func (a *LocalAuth) WithRequest(r *http.Request) AuthProvider {
	return requestAuth{base: a, secure: RequestIsHTTPS(r)}
}

type requestAuth struct {
	base   *LocalAuth
	secure bool
}

func (a requestAuth) Login(ctx context.Context, username, password string) (Principal, error) {
	return a.base.Login(ctx, username, password)
}

func (a requestAuth) PrincipalFromRequest(r *http.Request) (Principal, bool) {
	return a.base.PrincipalFromRequest(r)
}

func (a requestAuth) SetSession(w http.ResponseWriter, p Principal) {
	a.base.writeSession(w, p, a.secure)
}

func (a requestAuth) ClearSession(w http.ResponseWriter) {
	a.base.clearSession(w, a.secure)
}

func RequestIsHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	proto := r.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		return false
	}
	first := strings.TrimSpace(strings.Split(proto, ",")[0])
	return strings.EqualFold(first, "https")
}

type sessionPayload struct {
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	PersonID  string `json:"personId"`
	Iat       int64  `json:"iat"`
	Exp       int64  `json:"exp"`
}

func (a *LocalAuth) writeSession(w http.ResponseWriter, p Principal, secure bool) {
	now := time.Now()
	payload := sessionPayload{
		AccountID: p.AccountID, Username: p.Username, Role: p.Role, PersonID: p.PersonID,
		Iat: now.Unix(), Exp: now.Add(7 * 24 * time.Hour).Unix(),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	token := base64.RawURLEncoding.EncodeToString(raw) + "." + sign(a.secret, raw)
	http.SetCookie(w, &http.Cookie{
		Name: CookieName, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: secure, MaxAge: 7 * 24 * 3600,
	})
	role := p.Role
	if role != "editor" && role != "viewer" {
		role = "viewer"
	}
	http.SetCookie(w, &http.Cookie{
		Name: RoleCookieName, Value: role, Path: "/", HttpOnly: false,
		SameSite: http.SameSiteLaxMode, Secure: secure, MaxAge: 7 * 24 * 3600,
	})
}

func (a *LocalAuth) clearSession(w http.ResponseWriter, secure bool) {
	for _, name := range []string{CookieName, RoleCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name: name, Value: "", Path: "/", HttpOnly: name == CookieName,
			SameSite: http.SameSiteLaxMode, Secure: secure, MaxAge: -1, Expires: time.Unix(0, 0),
		})
	}
}

func (a *LocalAuth) parse(token string) (Principal, bool) {
	if a.revokedToken(token) {
		return Principal{}, false
	}
	encoded, sig, ok := strings.Cut(token, ".")
	if !ok || encoded == "" || sig == "" {
		return Principal{}, false
	}
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return Principal{}, false
	}
	got, err := hex.DecodeString(sig)
	if err != nil {
		return Principal{}, false
	}
	mac := hmac.New(sha256.New, []byte(a.secret))
	mac.Write(raw)
	if !hmac.Equal(got, mac.Sum(nil)) {
		return Principal{}, false
	}
	var payload sessionPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return Principal{}, false
	}
	if payload.Exp <= time.Now().Unix() || payload.AccountID == "" || (payload.Role != "editor" && payload.Role != "viewer") {
		return Principal{}, false
	}
	return Principal{AccountID: payload.AccountID, Username: payload.Username, Role: payload.Role, PersonID: payload.PersonID}, true
}

// RefreshIfStale reissues the cookie after 12 hours so a stolen cookie's
// window does not stay fixed for the full week.
func (a *LocalAuth) RefreshIfStale(w http.ResponseWriter, r *http.Request, p Principal, secure bool) {
	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" || a.revokedToken(cookie.Value) {
		return
	}
	encoded, _, ok := strings.Cut(cookie.Value, ".")
	if !ok {
		return
	}
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return
	}
	var payload sessionPayload
	if json.Unmarshal(raw, &payload) != nil {
		return
	}
	if payload.Iat != 0 && time.Now().Unix()-payload.Iat < 12*3600 {
		return
	}
	a.writeSession(w, p, secure)
}

func sign(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
