#!/usr/bin/env node
/*
 * Run a command with a component's Python virtualenv and the root .env, from
 * that component's folder. Works on Windows and POSIX.
 *
 *   node scripts/run-python.mjs ai main.py
 *   node scripts/run-python.mjs analytics -m data_processing.pipeline --days 30
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [component, ...args] = process.argv.slice(2);
if (!["ai", "analytics"].includes(component ?? "")) {
  console.error("usage: run-python.mjs <ai|analytics> <python args...>");
  process.exit(2);
}

const cwd = join(ROOT, component);
const venvPython = process.platform === "win32" ? join(cwd, ".venv", "Scripts", "python.exe") : join(cwd, ".venv", "bin", "python");
if (!existsSync(venvPython)) {
  console.error(`No virtualenv at ${component}/.venv. Create it first:\n  python3.12 -m venv ${component}/.venv && ${component}/.venv/bin/pip install -r ${component}/requirements.txt`);
  process.exit(1);
}

const env = { ...process.env };
const envFile = join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
env.PYTHONIOENCODING = "utf-8";

const child = spawn(venvPython, args, { cwd, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
