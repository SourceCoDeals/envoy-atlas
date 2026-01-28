/**
 * Production-ready logger utility
 * 
 * Levels:
 * - debug: Development only - verbose debugging info
 * - info: Development only - general information
 * - warn: Always logged - potential issues
 * - error: Always logged - errors (future: external tracking)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

/**
 * Format log message with timestamp and optional context
 */
const formatMessage = (level: LogLevel, message: string, context?: LogContext): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

/**
 * Structured logger with environment-aware logging
 */
export const logger = {
  /**
   * Debug level - only in development
   * Use for verbose debugging information
   */
  debug: (message: string, context?: LogContext): void => {
    if (isDev) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  /**
   * Info level - only in development
   * Use for general operational information
   */
  info: (message: string, context?: LogContext): void => {
    if (isDev) {
      console.info(formatMessage('info', message, context));
    }
  },

  /**
   * Warn level - always logged
   * Use for potentially harmful situations
   */
  warn: (message: string, context?: LogContext): void => {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error level - always logged
   * Use for error conditions
   * Future: Will integrate with external error tracking service
   */
  error: (message: string, error?: Error | unknown, context?: LogContext): void => {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack?.slice(0, 500),
      }),
    };
    console.error(formatMessage('error', message, errorContext));
    
    // Future: Send to external error tracking service
    // if (!isDev) {
    //   errorTrackingService.capture(error, { message, ...context });
    // }
  },

  /**
   * Log a metric event (e.g., performance timing)
   * Always logged for analytics purposes
   */
  metric: (name: string, value: number, tags?: Record<string, string>): void => {
    if (isDev) {
      console.log(formatMessage('info', `METRIC: ${name}=${value}`, tags));
    }
    // Future: Send to analytics service
  },

  /**
   * Create a child logger with preset context
   */
  child: (defaultContext: LogContext) => ({
    debug: (msg: string, ctx?: LogContext) => logger.debug(msg, { ...defaultContext, ...ctx }),
    info: (msg: string, ctx?: LogContext) => logger.info(msg, { ...defaultContext, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { ...defaultContext, ...ctx }),
    error: (msg: string, err?: Error | unknown, ctx?: LogContext) => 
      logger.error(msg, err, { ...defaultContext, ...ctx }),
  }),
};

export default logger;
