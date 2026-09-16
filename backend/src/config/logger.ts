/*
 * Structured JSON logging to stdout, one object per line.
 *
 * Never pass request bodies, tokens, passwords or patient text to the logger:
 * log identifiers and outcomes only.
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold: Level = process.env.NODE_ENV === "production" ? "info" : "debug";

function write(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[threshold] || process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};
