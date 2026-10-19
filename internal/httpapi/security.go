package httpapi

import (
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"fpm/internal/auth"
)

const loginFailureLimit = 10

// failureWindow counts recent events for one key.
type failureWindow struct {
	mu sync.Mutex
	at map[string][]time.Time
}

func (f *failureWindow) blocked(key string, now time.Time) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.recent(key, now)) >= loginFailureLimit
}

func (f *failureWindow) add(key string, now time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.at[key] = append(f.recent(key, now), now)
}

func (f *failureWindow) recent(key string, now time.Time) []time.Time {
	if f.at == nil {
		f.at = map[string][]time.Time{}
	}
	cutoff := now.Add(-time.Minute)
	kept := f.at[key][:0]
	for _, stamp := range f.at[key] {
		if stamp.After(cutoff) {
			kept = append(kept, stamp)
		}
	}
	f.at[key] = kept
	return kept
}

func clientKey(r *http.Request, username string) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return host + "\n" + strings.ToLower(strings.TrimSpace(username))
}

// sameSiteMutation reports whether a cookie-authenticated write is allowed.
// Browsers send Origin on POST. A missing Origin is a non-browser client
// (tests, fpmctl) and is allowed. Cross-site browser requests are rejected.
func sameSiteMutation(r *http.Request) bool {
	switch r.Header.Get("Sec-Fetch-Site") {
	case "cross-site":
		return false
	}
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" || origin == "null" {
		return origin == ""
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" {
		return false
	}
	return strings.EqualFold(parsed.Host, r.Host)
}

func setSecurityHeaders(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("X-Frame-Options", "DENY")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	// The static Next export inlines its bootstrap script, so script-src and
	// style-src allow 'unsafe-inline'. frame-ancestors still blocks embedding.
	header.Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'")
	if auth.RequestIsHTTPS(r) {
		header.Set("Strict-Transport-Security", "max-age=15552000")
	}
}
