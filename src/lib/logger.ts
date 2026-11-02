/**
 * Structured logger that silences client-side noise in production
 * while preserving critical error tracking and diagnostics in development.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    // Errors are preserved in dev; in production, avoid leaking sensitive stack traces
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      // Production structured reporting placeholder (e.g. Sentry / Datadog)
      console.error(`[ERROR] ${message}`);
    }
  },
};

