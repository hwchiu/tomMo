package web

import "embed"

// Dist is the Next.js static export. Docker overwrites web/dist before this package is compiled.
//
//go:embed all:dist
var Dist embed.FS
