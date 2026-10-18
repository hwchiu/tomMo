package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"fpm/internal/apierr"
	"fpm/internal/auth"
	"fpm/internal/domain"
	"fpm/internal/store"
	"fpm/internal/views"
	"fpm/web"
)

// Config controls process-level settings. Empty strings pick the documented defaults.
type Config struct {
	DataDir        string
	SessionSecret  string
	AdminUsername  string
	AdminPassword  string
	ViewerUsername string
	ViewerPassword string
	BcryptCost     int
	Logger         *slog.Logger
}

// Server is the monolith: JSON API plus the embedded static export.
type Server struct {
	store        *store.Store
	auth         auth.AuthProvider
	local        *auth.LocalAuth
	static       fs.FS
	log          *slog.Logger
	showDemoHint bool
}

func New(cfg Config) (*Server, error) {
	if cfg.DataDir == "" {
		cfg.DataDir = "data"
	}
	if cfg.SessionSecret == "" {
		cfg.SessionSecret = "dev-session-secret"
	}
	if cfg.AdminUsername == "" {
		cfg.AdminUsername = "admin"
	}
	if cfg.AdminPassword == "" {
		cfg.AdminPassword = "admin"
	}
	if cfg.ViewerUsername == "" {
		cfg.ViewerUsername = "viewer"
	}
	if cfg.ViewerPassword == "" {
		cfg.ViewerPassword = "viewer"
	}
	st, err := store.Open(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	if err := st.EnsureAccounts(store.AccountConfig{
		AdminUsername: cfg.AdminUsername, AdminPassword: cfg.AdminPassword,
		ViewerUsername: cfg.ViewerUsername, ViewerPassword: cfg.ViewerPassword,
		BcryptCost: cfg.BcryptCost,
	}); err != nil {
		_ = st.Close()
		return nil, err
	}
	sub, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		_ = st.Close()
		return nil, err
	}
	local := auth.NewLocal(cfg.SessionSecret, func(ctx context.Context, username string) (string, string, string, string, bool, error) {
		return st.FindAccount(ctx, username)
	})
	logger := cfg.Logger
	if logger == nil {
		logger = slog.New(slog.NewJSONHandler(io.Discard, nil))
	}
	demo := cfg.AdminUsername == "admin" && cfg.AdminPassword == "admin" &&
		cfg.ViewerUsername == "viewer" && cfg.ViewerPassword == "viewer"
	return &Server{store: st, auth: local, local: local, static: sub, log: logger, showDemoHint: demo}, nil
}

func (s *Server) Close() error { return s.store.Close() }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	defer func() {
		if recovered := recover(); recovered != nil {
			s.log.Error("panic", "method", r.Method, "path", r.URL.Path, "err", recovered)
			if !rec.wrote {
				writeJSON(rec, http.StatusInternalServerError, map[string]string{"message": "伺服器錯誤"})
			}
		}
		s.log.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "dur_ms", time.Since(start).Milliseconds())
	}()
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	r = r.WithContext(ctx)
	s.route(rec, r)
}

func (s *Server) route(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api" {
		s.serveAPI(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.FileServer(http.FS(s.static)).ServeHTTP(w, r)
}

func (s *Server) serveAPI(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if len(path) > 1 {
		path = strings.TrimRight(path, "/")
	}
	method := r.Method
	sessionAuth := s.auth
	if s.local != nil {
		sessionAuth = s.local.WithRequest(r)
	}
	principal, ok := sessionAuth.PrincipalFromRequest(r)

	if method == http.MethodGet && path == "/api/v1/login-config" {
		writeJSON(w, http.StatusOK, map[string]bool{"showDemoHint": s.showDemoHint})
		return
	}
	if method == http.MethodPost && path == "/api/v1/login" {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := decode(r, &body); err != nil {
			s.writeErr(w, apierr.New(400, "請求格式不正確"))
			return
		}
		if strings.TrimSpace(body.Username) == "" || body.Password == "" {
			s.writeErr(w, apierr.New(400, "請輸入帳號與密碼"))
			return
		}
		p, err := sessionAuth.Login(r.Context(), body.Username, body.Password)
		if err != nil {
			s.writeErr(w, err)
			return
		}
		sessionAuth.SetSession(w, p)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if method == http.MethodPost && path == "/api/v1/logout" {
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "請先登入"})
			return
		}
		sessionAuth.ClearSession(w)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "請先登入"})
		return
	}
	if method != http.MethodGet && principal.Role != "editor" {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "使用者只能閱讀"})
		return
	}

	result, err := s.dispatch(r, path, principal)
	if err != nil {
		s.writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) dispatch(r *http.Request, path string, principal auth.Principal) (any, error) {
	method := r.Method
	parts := splitPath(path)
	actorID := principal.PersonID

	if method == http.MethodPost && path == "/api/v1/session/reset" {
		if err := s.store.ResetContext(r.Context()); err != nil {
			return nil, err
		}
		return map[string]bool{"ok": true}, nil
	}
	if method == http.MethodGet && path == "/api/v1/bootstrap" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) {
			return views.BuildBootstrap(db, actorID, principal.Role, principal.Username)
		})
	}
	if method == http.MethodGet && path == "/api/v1/people" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildPeople(db, listQuery(r)), nil })
	}
	if method == http.MethodPost && path == "/api/v1/people" {
		var body store.PersonInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreatePerson(db, actorID, body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "people" {
		var body store.PersonInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdatePerson(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && path == "/api/v1/portfolio" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildPortfolio(db) })
	}
	if method == http.MethodGet && path == "/api/v1/product-build" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildProductBuild(db) })
	}
	if method == http.MethodGet && path == "/api/v1/factories" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildFactories(db) })
	}
	if method == http.MethodPost && path == "/api/v1/factories" {
		var body store.FactoryInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateFactory(db, actorID, body) })
	}
	if method == http.MethodGet && len(parts) == 4 && parts[0] == "api" && parts[2] == "factories" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildFactory(db, parts[3]) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[0] == "api" && parts[2] == "factories" {
		var body store.FactoryInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateFactory(db, actorID, parts[3], body) })
	}
	if method == http.MethodPost && len(parts) == 5 && parts[2] == "factories" && parts[4] == "topics" {
		var body store.TopicInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateTopic(db, actorID, parts[3], body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "topics" {
		var body store.TopicInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateTopic(db, actorID, parts[3], body) })
	}
	if method == http.MethodPost && len(parts) == 5 && parts[2] == "factories" && parts[4] == "phases" {
		var body store.PhaseInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreatePhase(db, actorID, parts[3], body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "phases" {
		var body store.PhaseInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdatePhase(db, actorID, parts[3], body) })
	}
	if method == http.MethodPost && len(parts) >= 5 && parts[2] == "phases" && parts[4] == "milestones" {
		var body store.MilestoneInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateMilestone(db, actorID, parts[3], body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "milestones" {
		var body store.MilestoneInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateMilestone(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && path == "/api/v1/issues" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildIssues(db, listQuery(r)) })
	}
	if method == http.MethodPost && path == "/api/v1/issues" {
		var body store.IssueInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateIssue(db, actorID, body) })
	}
	if method == http.MethodGet && len(parts) == 4 && parts[2] == "issues" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildIssue(db, parts[3]) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "issues" {
		var body store.IssueInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateIssue(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && path == "/api/v1/products" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildProducts(db) })
	}
	if method == http.MethodPost && path == "/api/v1/products" {
		var body store.ProductInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateProduct(db, actorID, body) })
	}
	if method == http.MethodGet && len(parts) == 4 && parts[2] == "products" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildProduct(db, parts[3]) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "products" {
		var body store.ProductInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateProduct(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && path == "/api/v1/capabilities" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildCapabilities(db) })
	}
	if method == http.MethodGet && len(parts) == 4 && parts[2] == "deployments" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildDeployment(db, parts[3]) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "deployments" {
		var body store.DeploymentInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateDeployment(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && len(parts) == 7 && parts[2] == "factories" && parts[4] == "products" && parts[6] == "plan" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) {
			return views.BuildPlan(db, parts[3], parts[5], actorID, principal.Role)
		})
	}
	if method == http.MethodPut && len(parts) == 7 && parts[2] == "factories" && parts[4] == "products" && parts[6] == "plan" {
		var body store.PlanInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) {
			return store.SavePlan(db, actorID, parts[3], parts[5], body)
		})
	}
	if method == http.MethodPost && len(parts) == 8 && parts[2] == "factories" && parts[4] == "products" && parts[6] == "plan" && parts[7] == "approve" {
		return s.write(r.Context(), func(db *domain.Database) (any, error) {
			return store.ApprovePlan(db, actorID, parts[3], parts[5])
		})
	}
	if method == http.MethodGet && path == "/api/v1/activity" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) { return views.BuildActivity(db, listQuery(r)), nil })
	}
	if method == http.MethodPost && path == "/api/v1/enumerations" {
		var body store.EnumerationInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateEnumeration(db, actorID, body) })
	}
	if method == http.MethodPost && path == "/api/v1/machine-types" {
		var body store.MachineTypeInput
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.CreateMachineType(db, actorID, body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "machine-types" {
		var body store.MachineTypePatch
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateMachineType(db, actorID, parts[3], body) })
	}
	if method == http.MethodPatch && len(parts) == 4 && parts[2] == "enumerations" {
		var body store.EnumerationPatch
		if err := decode(r, &body); err != nil {
			return nil, apierr.New(400, "請求格式不正確")
		}
		return s.write(r.Context(), func(db *domain.Database) (any, error) { return store.UpdateEnumeration(db, actorID, parts[3], body) })
	}
	if method == http.MethodGet && len(parts) >= 3 && parts[2] == "feature-diff" {
		return s.read(r.Context(), func(db *domain.Database) (any, error) {
			from := queryPtr(r, "from")
			to := r.URL.Query().Get("to")
			return views.FeatureDiff{Changes: store.DiffVersionFeatures(db, from, to)}, nil
		})
	}
	return nil, apierr.New(404, "沒有這個 API："+method+" "+path)
}

func (s *Server) read(ctx context.Context, fn func(*domain.Database) (any, error)) (any, error) {
	var out any
	err := s.store.ReadContext(ctx, func(db *domain.Database) error {
		var ferr error
		out, ferr = fn(db)
		return ferr
	})
	return out, err
}

func (s *Server) write(ctx context.Context, fn func(*domain.Database) (any, error)) (any, error) {
	var out any
	err := s.store.WriteContext(ctx, func(db *domain.Database) error {
		var ferr error
		out, ferr = fn(db)
		return ferr
	})
	return out, err
}

func splitPath(path string) []string {
	raw := strings.Split(path, "/")
	out := make([]string, 0, len(raw))
	for _, part := range raw {
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func queryPtr(r *http.Request, key string) *string {
	values, ok := r.URL.Query()[key]
	if !ok || len(values) == 0 {
		return nil
	}
	v := values[0]
	return &v
}

func decode(r *http.Request, dst any) error {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20+1))
	if err != nil {
		return err
	}
	if len(raw) > 1<<20 {
		return errors.New("body too large")
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return nil
	}
	return json.Unmarshal(raw, dst)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		slog.Default().Error("write json", "err", err)
	}
}

func (s *Server) writeErr(w http.ResponseWriter, err error) {
	var api *apierr.Error
	if errors.As(err, &api) {
		writeJSON(w, api.Status, map[string]string{"message": api.Message})
		return
	}
	if errors.Is(err, context.Canceled) {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "請求已取消"})
		return
	}
	if errors.Is(err, context.DeadlineExceeded) {
		writeJSON(w, http.StatusGatewayTimeout, map[string]string{"message": "請求逾時"})
		return
	}
	s.log.Error("request failed", "err", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "伺服器錯誤"})
}
