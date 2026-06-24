#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const widgetDist = resolve(repoRoot, "dist", "widget");

const port = process.env["PREVIEW_WIDGET_PORT"] ?? "4173";
const host = process.env["PREVIEW_WIDGET_HOST"] ?? "127.0.0.1";

const proc = spawn(
  process.execPath,
  [
    resolve(repoRoot, "node_modules", "vite", "bin", "vite.js"),
    "preview",
    "--outDir",
    widgetDist,
    "--port",
    port,
    "--host",
    host,
    "--strictPort",
  ],
  { stdio: "inherit", cwd: repoRoot },
);

proc.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
