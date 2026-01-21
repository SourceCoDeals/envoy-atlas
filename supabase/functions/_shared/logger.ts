/**
 * Structured Logging Infrastructure for Edge Functions
 * 
 * Provides consistent, structured JSON logging with automatic context.
 * Logs are stored in function_logs table for analysis.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  functionName: string;
  requestId?: string;
  workspaceId?: string;
  engagementId?: string;
  userId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
  timestamp: string;
  durationMs?: number;
}

/**
 * Creates a logger instance for a specific edge function
 */
export function createLogger(functionName: string, context: Partial<LogContext> = {}) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  
  const baseContext: LogContext = {
    functionName,
    requestId,
    ...context,
  };

  const formatMessage = (level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry => ({
    level,
    message,
    context: baseContext,
    metadata: meta,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  });

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const entry = formatMessage(level, message, meta);
    
    // Console output for Supabase logs
    const consoleMessage = `[${entry.context.functionName}:${entry.context.requestId}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(consoleMessage, meta || '');
        break;
      case 'info':
        console.log(consoleMessage, meta || '');
        break;
      case 'warn':
        console.warn(consoleMessage, meta || '');
        break;
      case 'error':
        console.error(consoleMessage, meta || '');
        break;
    }

    return entry;
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),

    /**
     * Log with duration calculation from a start time
     */
    timed: (level: LogLevel, message: string, startMs: number, meta?: Record<string, unknown>) => {
      return log(level, message, { ...meta, durationMs: Date.now() - startMs });
    },

    /**
     * Add context for subsequent logs
     */
    withContext(additionalContext: Partial<LogContext>) {
      Object.assign(baseContext, additionalContext);
    },

    /**
     * Get elapsed time since logger creation
     */
    elapsed: () => Date.now() - startTime,

    /**
     * Persist log entry to database (async, fire-and-forget)
     */
    async persist(entry: LogEntry) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseServiceKey) return;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase.from('function_logs').insert({
          function_name: entry.context.functionName,
          level: entry.level,
          message: entry.message,
          metadata: {
            ...entry.metadata,
            request_id: entry.context.requestId,
            duration_ms: entry.durationMs,
          },
          engagement_id: entry.context.engagementId || null,
          workspace_id: entry.context.workspaceId || null,
        });
      } catch (e) {
        // Don't let logging failures crash the function
        console.error('Failed to persist log:', e);
      }
    },
  };
}

/**
 * Wrap a function with automatic error logging and timing
 */
export function withLogging<T>(
  logger: ReturnType<typeof createLogger>,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  logger.info(`Starting: ${operation}`);
  
  return fn()
    .then((result) => {
      logger.timed('info', `Completed: ${operation}`, start);
      return result;
    })
    .catch((error) => {
      logger.timed('error', `Failed: ${operation}`, start, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    });
}

/**
 * Exponential backoff retry wrapper with logging
 */
export async function withRetry<T>(
  logger: ReturnType<typeof createLogger>,
  operation: string,
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryOn = () => true,
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        logger.info(`Retry ${attempt}/${maxRetries} for ${operation}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (!retryOn(lastError) || attempt === maxRetries) {
        logger.error(`${operation} failed after ${attempt + 1} attempts`, {
          error: lastError.message,
          attempts: attempt + 1,
        });
        throw lastError;
      }
      
      logger.warn(`${operation} attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw lastError;
}

/**
 * Create sync error entry for dead letter queue
 */
export async function logSyncError(
  supabase: ReturnType<typeof createClient>,
  params: {
    workspaceId: string;
    dataSourceId?: string;
    platform: string;
    operation: string;
    errorMessage: string;
    recordId?: string;
    rawData?: unknown;
    retryCount?: number;
  }
): Promise<void> {
  try {
    // Log to function_logs table instead (sync_errors may not exist yet)
    await supabase.from('function_logs').insert({
      function_name: `sync-error-${params.platform}`,
      level: 'error',
      message: `${params.operation}: ${params.errorMessage}`,
      metadata: {
        workspace_id: params.workspaceId,
        data_source_id: params.dataSourceId,
        platform: params.platform,
        operation: params.operation,
        record_id: params.recordId,
        raw_data: params.rawData,
        retry_count: params.retryCount || 0,
      },
      workspace_id: params.workspaceId,
    } as any);
  } catch (e) {
    console.error('Failed to log sync error:', e);
  }
}
