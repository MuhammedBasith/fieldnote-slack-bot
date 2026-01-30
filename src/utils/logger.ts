type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return error;
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (LOG_LEVELS.debug >= LOG_LEVELS[currentLevel]) {
      console.debug(formatLog("debug", message, context));
    }
  },

  info(message: string, context?: LogContext) {
    if (LOG_LEVELS.info >= LOG_LEVELS[currentLevel]) {
      console.info(formatLog("info", message, context));
    }
  },

  warn(message: string, context?: LogContext) {
    if (LOG_LEVELS.warn >= LOG_LEVELS[currentLevel]) {
      console.warn(formatLog("warn", message, context));
    }
  },

  error(message: string, context?: LogContext) {
    if (LOG_LEVELS.error >= LOG_LEVELS[currentLevel]) {
      const processedContext = context
        ? {
            ...context,
            error: context.error ? serializeError(context.error) : undefined,
          }
        : undefined;
      console.error(formatLog("error", message, processedContext));
    }
  },
};
