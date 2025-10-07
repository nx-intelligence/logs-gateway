/**
 * logs-gateway - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the logs gateway package.
 */

/**
 * Supported log levels in order of priority
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Output format options for log entries
 */
export type LogFormat = 'text' | 'json';

/**
 * Configuration for logging behavior
 */
export interface LoggingConfig {
  /** Enable console output (default: true) */
  logToConsole?: boolean;
 
  /** Enable file output (default: false) */
  logToFile?: boolean;
 
  /** File path for logs (required if logToFile is true) */
  logFilePath?: string;
 
  /** Minimum log level to output (default: 'info') */
  logLevel?: LogLevel;
 
  /** Output format: 'text' or 'json' (default: 'text') */
  logFormat?: LogFormat;
 
  /** Custom logger implementation (advanced use) */
  customLogger?: CustomLogger;

  /** Enable unified-logger output (default: false) */
  enableUnifiedLogger?: boolean;

  /** Unified logger configuration */
  unifiedLogger?: UnifiedLoggerConfig;

  /** Default source for logs emitted by this logger if not provided per-call */
  defaultSource?: string;
}

/**
 * Custom logger interface for injecting external loggers (Winston, Pino, etc.)
 */
export interface CustomLogger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

/**
 * Package identification configuration
 */
export interface LoggerPackageConfig {
  /** Display name in logs (e.g., 'MY_APP', 'DATABASE_SERVICE') */
  packageName: string;
 
  /** Environment variable prefix (e.g., 'MY_APP', 'DB_SERVICE') */
  envPrefix: string;
 
  /** Debug namespace for DEBUG env var (e.g., 'my-app', 'db-service') */
  debugNamespace?: string;
}

/**
 * Structured log entry (used for JSON format)
 */
export interface LogEntry {
  timestamp: string;
  package: string;
  level: string;
  message: string;
  data?: any;
}

/**
 * Routing metadata for controlling log output destinations
 */
export interface RoutingMeta {
  /** Allowed output destinations (e.g., ['unified-logger', 'console']) */
  allowedOutputs?: string[];
  /** Blocked output destinations (e.g., ['unified-logger', 'file']) */
  blockOutputs?: string[];
  /** Debugging aid for why routing rules were applied */
  reason?: string;
  /** Optional hints for routing decisions */
  tags?: string[];
}

/**
 * Log metadata that can be attached to log entries
 */
export interface LogMeta {
  /** Backward-compatible payload - any additional data */
  [key: string]: any;
  /** Source identifier for the log entry */
  source?: string;
  /** Correlation ID for tracing related log entries */
  correlationId?: string;
  /** Routing metadata for controlling output destinations */
  _routing?: RoutingMeta;
}

/**
 * Unified logger transport configuration
 */
export interface UnifiedLoggerTransports {
  /** Enable console output via unified-logger */
  console?: boolean;
  /** Enable Papertrail output via unified-logger */
  papertrail?: boolean;
  /** Enable UDP relay output via unified-logger */
  udpRelay?: boolean;
}

/**
 * Unified logger configuration
 */
export interface UnifiedLoggerConfig {
  /** Path to logger.json config file */
  configPath?: string;
  /** Inline @x-developer/unified-logger ILoggerConfig */
  configInline?: any;
  
  /** Simple overrides */
  service?: string;
  env?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  transports?: UnifiedLoggerTransports;
  
  /** Optional level filter for this output */
  levels?: LogLevel[];
}

/**
 * Internal configuration type with all required fields
 */
export type InternalLoggingConfig = Required<Omit<LoggingConfig, 'customLogger' | 'unifiedLogger'>> & { 
  customLogger?: CustomLogger;
  unifiedLogger?: UnifiedLoggerConfig;
  packageName: string;
};
