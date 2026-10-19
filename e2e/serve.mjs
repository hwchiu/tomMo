import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { adminPassword, port, viewerPassword } from "./passwords.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = await mkdtemp(path.join(tmpdir(), "fpm-e2e-"));
const base = `http://127.0.0.1:${port}`;

function redact(text) {
  return String(text ?? "").split(adminPassword).join("[redacted]").split(viewerPassword).join("[redacted]");
}

function start(seed) {
  return spawn(path.join(root, "bin", "fpm"), [], {
    cwd: root,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: port,
      SEED_MODE: seed,
      INITIAL_ADMIN_PASSWORD: adminPassword,
      INITIAL_VIEWER_PASSWORD: viewerPassword,
      SESSION_SECRET: "e2e-session-secret",
      DEV_DEFAULT_PASSWORDS: "",
      LOG_INITIAL_PASSWORDS: "",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
}

async function waitHealthy() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) return;
    } catch {
      /* process is still binding the port */
    }
    await delay(250);
  }
  throw new Error("server did not become healthy");
}

function waitExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", () => resolve());
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([waitExit(child), delay(8000).then(() => child.kill("SIGKILL"))]);
  await waitExit(child);
}

let server;
async function shutdown() {
  if (server) await stop(server);
  await rm(dataDir, { recursive: true, force: true });
}

try {
  const bootstrap = start("none");
  await waitHealthy();
  const imported = spawnSync(path.join(root, "bin", "fpmctl"), [
    "import", "--dir", "data/demo", "--base", base, "--user", "admin", "--password", adminPassword,
  ], { cwd: root, encoding: "utf8" });
  await stop(bootstrap);
  if (imported.status !== 0) {
    console.error(redact(imported.stdout));
    console.error(redact(imported.stderr));
    throw new Error(`fpmctl import exited ${imported.status}`);
  }
  server = start("demo");
  await waitHealthy();
} catch (error) {
  console.error(redact(error instanceof Error ? error.stack : error));
  await shutdown();
  process.exit(1);
}

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
server.on("exit", (code) => {
  void rm(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
