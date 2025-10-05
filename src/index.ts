/**
 * logs-gateway - Main Entry Point
 * 
 * This file exports all public APIs and provides the main factory function.
 */

// Re-export all types
export type {
  LogLevel,
  LogFormat,
  LoggingConfig,
  CustomLogger,
  LoggerPackageConfig,
  LogEntry,
  InternalLoggingConfig
} from './types';

// Re-export the LogsGateway class
export { LogsGateway } from './logger';

// Import LogsGateway for the factory function
import { LogsGateway } from './logger';
import type { LoggerPackageConfig, LoggingConfig } from './types';

/**
 * Create a package-specific logger instance
 *
 * @param packageConfig - Package identification (name, env prefix, debug namespace)
 * @param userConfig - Optional logging configuration
 * @returns LogsGateway instance configured for the package
 *
 * @example
 * ```typescript
 * import { createLogger } from 'logs-gateway';
 *
 * const logger = createLogger(
 *   { packageName: 'MY_APP', envPrefix: 'MY_APP', debugNamespace: 'my-app' },
 *   { logToFile: true, logFilePath: '/var/log/myapp.log' }
 * );
 *
 * logger.info('Application initialized');
 * ```
 */
export function createLogger(
  packageConfig: LoggerPackageConfig,
  userConfig?: LoggingConfig
): LogsGateway {
  return new LogsGateway(packageConfig, userConfig);
}

// Default export for convenience
export default {
  createLogger,
  LogsGateway
};
