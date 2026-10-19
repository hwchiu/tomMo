package impex

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// endpoint builds an API URL on base. base must be http(s), must not carry
// credentials, and must not resolve to a private, link-local, or metadata address.
// Loopback is allowed so the CLI can talk to the local server.
func endpoint(base, path string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(base))
	if err != nil || u.Host == "" || u.Hostname() == "" {
		return "", fmt.Errorf("服務位址不正確")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("服務位址只允許 http 或 https")
	}
	if u.User != nil {
		return "", fmt.Errorf("服務位址不可包含帳號")
	}
	if blockedHost(u.Hostname()) {
		return "", fmt.Errorf("不允許的服務位址")
	}
	ips, err := net.LookupIP(u.Hostname())
	if err != nil || len(ips) == 0 {
		return "", fmt.Errorf("無法解析服務位址")
	}
	for _, ip := range ips {
		if blockedIP(ip) {
			return "", fmt.Errorf("不允許的服務位址")
		}
	}
	u.Path = path
	u.RawPath = ""
	u.RawQuery = ""
	u.Fragment = ""
	return u.String(), nil
}

func blockedHost(host string) bool {
	switch strings.ToLower(strings.TrimSuffix(host, ".")) {
	case "metadata.google.internal", "metadata.internal":
		return true
	default:
		return false
	}
}

func blockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	if ip.IsLoopback() {
		return false
	}
	return ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified()
}
