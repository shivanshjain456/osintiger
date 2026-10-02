// Structured logging utility — provides consistent, parseable log output.
// Replaces ad-hoc console.log/error/warn calls with structured format that
// can be ingested by log aggregation systems (ELK, Datadog, CloudWatch, etc.)
//
// Usage:
//   logger.info("pipeline", "Investigation started", { id, target });
//   logger.error("ai-client", "Synthesis failed", { attempt, error: e.message });
//   logger.warn("store", "Cache miss, falling back to DB", { id });

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

function formatLog(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const ts = new Date().toISOString();
  const ctxStr = context ? " " + JSON.stringify(context) : "";
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}${ctxStr}`;
}

export const logger = {
  debug(module: string, message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", module, message, context));
    }
  },

  info(module: string, message: string, context?: LogContext): void {
    console.log(formatLog("info", module, message, context));
  },

  warn(module: string, message: string, context?: LogContext): void {
    console.warn(formatLog("warn", module, message, context));
  },

  error(module: string, message: string, context?: LogContext): void {
    console.error(formatLog("error", module, message, context));
  },
};
