#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const previewRoot = join(repoRoot, "docs", "design", "v1-research-preview");
const defaultPort = 4175;
const stateDir = process.env.COGVEST_PREVIEW_STATE_DIR || join(repoRoot, ".preview-server");
const pidFile = join(stateDir, "cogvest-v1-preview.pid");
const outLog = join(stateDir, "cogvest-v1-preview.out.log");
const errLog = join(stateDir, "cogvest-v1-preview.err.log");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);

function parseArgs(argv) {
  const [command = "serve", ...rest] = argv;
  const options = { command, host: "127.0.0.1", port: defaultPort };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--port") {
      options.port = Number(rest[index + 1]);
      index += 1;
    } else if (arg === "--host") {
      options.host = rest[index + 1];
      index += 1;
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }

  return options;
}

function ensurePreviewExists() {
  const indexPath = join(previewRoot, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`Preview index not found: ${indexPath}`);
  }
}

function ensureStateDir() {
  mkdirSync(stateDir, { recursive: true });
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  if (!existsSync(pidFile)) {
    return null;
  }

  const pid = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isInteger(pid) ? pid : null;
}

function resolveRequestPath(url = "/") {
  const parsed = new URL(url, "http://localhost");
  const requested = parsed.pathname === "/" ? "/index.html" : decodeURIComponent(parsed.pathname);
  const resolved = resolve(previewRoot, `.${requested}`);

  if (!resolved.startsWith(previewRoot)) {
    return null;
  }

  return resolved;
}

function serve({ host, port }) {
  ensurePreviewExists();
  ensureStateDir();
  writeFileSync(pidFile, String(process.pid));

  process.on("exit", () => {
    const pid = readPid();
    if (pid === process.pid && existsSync(pidFile)) {
      unlinkSync(pidFile);
    }
  });

  const server = createServer((request, response) => {
    const filePath = resolveRequestPath(request.url);

    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  });

  server.on("error", (error) => {
    console.error(`FAIL preview server: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    console.log(`PASS CogVest V1 preview running at http://${host}:${port}/`);
    console.log(`Serving ${previewRoot}`);
  });
}

function start(options) {
  ensurePreviewExists();
  ensureStateDir();

  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`PASS preview already running: pid ${existingPid}`);
    console.log(`Open http://${options.host}:${options.port}/`);
    return;
  }

  if (existingPid) {
    unlinkSync(pidFile);
  }

  writeFileSync(outLog, "");
  writeFileSync(errLog, "");

  const outFd = openSync(outLog, "a");
  const errFd = openSync(errLog, "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", "--host", options.host, "--port", String(options.port)], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
  });

  child.unref();
  writeFileSync(pidFile, String(child.pid));
  writeFileSync(outLog, `Started CogVest preview pid ${child.pid} at http://${options.host}:${options.port}/\n`);
  console.log(`PASS preview started: pid ${child.pid}`);
  console.log(`Open http://${options.host}:${options.port}/`);
}

function status(options) {
  const pid = readPid();
  if (!pid) {
    console.log("WARNING preview is not running: no pid file");
    console.log(`Logs: ${outLog} ${errLog}`);
    process.exitCode = 1;
    return;
  }

  if (!isRunning(pid)) {
    console.log(`WARNING preview is not running: stale pid ${pid}`);
    console.log(`Logs: ${outLog} ${errLog}`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS preview running: pid ${pid}`);
  console.log(`Open http://${options.host}:${options.port}/`);
}

function stop() {
  const pid = readPid();
  if (!pid) {
    console.log("WARNING preview is not running: no pid file");
    return;
  }

  if (isRunning(pid)) {
    process.kill(pid);
  }

  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }

  console.log(`PASS preview stopped: pid ${pid}`);
}

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === "serve") {
    serve(options);
  } else if (options.command === "start") {
    start(options);
  } else if (options.command === "status") {
    status(options);
  } else if (options.command === "stop") {
    stop();
  } else {
    throw new Error(`Unknown command: ${options.command}. Use serve, start, status, or stop.`);
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
