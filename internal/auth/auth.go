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
	"time"

	"fpm/internal/apierr"
	"golang.org/x/crypto/bcrypt"
)

const CookieName = "fpm_session"

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
	secret string
	lookup AccountLookup
}

func NewLocal(secret string, lookup AccountLookup) *LocalAuth {
	return &LocalAuth{secret: secret, lookup: lookup}
}

func (a *LocalAuth) Login(ctx context.Context, username, password string) (Principal, error) {
	id, hash, role, personID, ok, err := a.lookup(ctx, username)
	if err != nil {
		return Principal{}, err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return Principal{}, apierr.New(401, "帳號或密碼不正確")
	}
	return Principal{AccountID: id, Username: username, Role: role, PersonID: personID}, nil
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
	Exp       int64  `json:"exp"`
}

func (a *LocalAuth) writeSession(w http.ResponseWriter, p Principal, secure bool) {
	payload := sessionPayload{
		AccountID: p.AccountID, Username: p.Username, Role: p.Role, PersonID: p.PersonID,
		Exp: time.Now().Add(7 * 24 * time.Hour).Unix(),
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
}

func (a *LocalAuth) clearSession(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name: CookieName, Value: "", Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: secure, MaxAge: -1, Expires: time.Unix(0, 0),
	})
}

func (a *LocalAuth) parse(token string) (Principal, bool) {
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

func sign(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
