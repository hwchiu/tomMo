// Test-only credentials. The server reads them from the environment.
// Do not print these values.
export const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "e2e-admin-pass";
export const viewerPassword = process.env.INITIAL_VIEWER_PASSWORD || "e2e-viewer-pass";
export const port = process.env.E2E_PORT || "18080";
