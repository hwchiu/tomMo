package impex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"time"
)

type importBody struct {
	DryRun bool              `json:"dryRun"`
	Files  map[string]string `json:"files"`
}

type exportBody struct {
	Files map[string]string `json:"files"`
}

type messageBody struct {
	Message string `json:"message"`
}

// ImportRemote logs in and posts CSV texts to POST /api/v1/import.
func ImportRemote(ctx context.Context, base, user, password string, files map[string]string, dryRun bool) (Report, error) {
	client, err := authedClient(ctx, base, user, password)
	if err != nil {
		return Report{}, err
	}
	payload, err := json.Marshal(importBody{DryRun: dryRun, Files: files})
	if err != nil {
		return Report{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(base, "/")+"/api/v1/import", bytes.NewReader(payload))
	if err != nil {
		return Report{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return Report{}, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return Report{}, err
	}
	var report Report
	if err := json.Unmarshal(raw, &report); err != nil {
		return Report{}, fmt.Errorf("匯入回應無法解析（%d）", res.StatusCode)
	}
	report.normalize()
	if res.StatusCode >= 400 && len(report.Errors) == 0 {
		var msg messageBody
		_ = json.Unmarshal(raw, &msg)
		if msg.Message == "" {
			msg.Message = res.Status
		}
		report.Errors = append(report.Errors, RowError{Message: msg.Message})
	}
	return report, nil
}

// ExportRemote logs in and downloads GET /api/v1/export.
func ExportRemote(ctx context.Context, base, user, password string) (map[string]string, error) {
	client, err := authedClient(ctx, base, user, password)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/api/v1/export", nil)
	if err != nil {
		return nil, err
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		var msg messageBody
		_ = json.Unmarshal(raw, &msg)
		if msg.Message == "" {
			msg.Message = res.Status
		}
		return nil, fmt.Errorf("%s", msg.Message)
	}
	var body exportBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	return body.Files, nil
}

func authedClient(ctx context.Context, base, user, password string) (*http.Client, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Jar: jar, Timeout: 60 * time.Second}
	payload, err := json.Marshal(map[string]string{"username": user, "password": password})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(base, "/")+"/api/v1/login", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusOK {
		var msg messageBody
		_ = json.Unmarshal(raw, &msg)
		if msg.Message == "" {
			msg.Message = "登入失敗"
		}
		return nil, fmt.Errorf("%s", msg.Message)
	}
	return client, nil
}
