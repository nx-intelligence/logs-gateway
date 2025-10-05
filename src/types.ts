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
 * Internal configuration type with all required fields
 */
export type InternalLoggingConfig = Required<Omit<LoggingConfig, 'customLogger'>> & { 
  customLogger?: CustomLogger;
  packageName: string;
};
