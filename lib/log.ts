/**
 * Structured logging for backend operations.
 *
 * Every log line includes a unique request ID so failures can be traced
 * across multiple log entries in Vercel's production logs. In development
 * the ID is random; in production it comes from theincoming request header
 * (Vercel sets `x-vercel-id` on Function invocations).
 */

export interface LogContext {
  /** Unique ID for the request/operation. Generated if not provided. */
  requestId?: string;
  /** Human-readable label for what was being done. */
  operation?: string;
  /** Key identifiers (project id, media id, user email, etc.). */
  context?: Record<string, unknown>;
  /** HTTP status code if applicable. */
  status?: number;
}

let _counter = 0;
function nextId(): string {
  return `req-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
}

/**
 * Extract a request ID from a Next.js Request, falling back to a generated one.
 */
export function requestIdFromRequest(request: Request): string {
  const header = request.headers.get("x-vercel-id");
  if (header) return header;
  // Vercel also sets x-request-id on some plans.
  const alt = request.headers.get("x-request-id");
  if (alt) return alt;
  return nextId();
}

/**
 * Build a context string from a LogContext for inclusion in log messages.
 */
function ctxString(ctx: LogContext | undefined): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.operation) parts.push(`[${ctx.operation}]`);
  if (ctx.context) {
    const entries = Object.entries(ctx.context);
    if (entries.length > 0) {
      const serialized = entries
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ");
      parts.push(`{${serialized}}`);
    }
  }
  return parts.join(" ");
}

/**
 * Log an informational message.
 */
export function info(
  message: string,
  ctx?: LogContext
): void {
  const prefix = ctxString(ctx);
  console.info(`[INFO]${prefix ? " " + prefix : ""} ${message}`);
}

/**
 * Log a warning. Non-fatal — the operation may have succeeded or been
 * partially completed.
 */
export function warn(
  message: string,
  err?: unknown,
  ctx?: LogContext
): void {
  const prefix = ctxString(ctx);
  const extra = err ? ` (${formatErr(err)})` : "";
  console.warn(
    `[WARN]${prefix ? " " + prefix : ""} ${message}${extra}`
  );
  if (err instanceof Error) {
    console.warn(`  stack: ${err.stack}`);
  }
}

/**
 * Log an error that caused the operation to fail.
 */
export function error(
  message: string,
  err: unknown,
  ctx?: LogContext
): void {
  const prefix = ctxString(ctx);
  const extra = err ? ` (${formatErr(err)})` : "";
  console.error(`[ERROR]${prefix ? " " + prefix : ""} ${message}${extra}`);
  if (err instanceof Error) {
    console.error(`  stack: ${err.stack}`);
  } else if (typeof err === "object" && err !== null) {
    console.error(`  payload: ${JSON.stringify(err)}`);
  }
}

/**
 * Log when an operation is skipped or a fallback is used.
 */
export function debug(
  message: string,
  ctx?: LogContext
): void {
  const prefix = ctxString(ctx);
  console.debug(`[DEBUG]${prefix ? " " + prefix : ""} ${message}`);
}

/**
 * Flatten an unknown error to a short string for log inclusion.
 */
function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    // AWS SDK errors have Code and Message.
    if ("Code" in err && typeof (err as Record<string, unknown>).Code === "string") {
      return `${(err as Record<string, unknown>).Code}: ${(err as Record<string, unknown>).Message ?? ""}`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "unknown error object";
    }
  }
  return String(err);
}

/**
 * Build an ActionResult error from a caught exception, logging it first.
 */
export function logAndReturnError(
  err: unknown,
  operation: string,
  context: Record<string, unknown> = {}
): { ok: false; error: string } {
  error(`${operation} failed`, err, { operation, context });
  // Return a user-friendly message, not the raw error.
  return { ok: false, error: "Something went wrong. Please try again." };
}
