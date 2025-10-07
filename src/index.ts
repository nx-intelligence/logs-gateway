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
  InternalLoggingConfig,
  LogMeta,
  RoutingMeta,
  UnifiedLoggerConfig,
  UnifiedLoggerTransports
} from './types';

// Re-export the LogsGateway class
export { LogsGateway } from './logger';

// Import LogsGateway for the factory function
import { LogsGateway } from './logger';
import { UnifiedLoggerOutput } from './outputs/unified-logger-output';
import type { LoggerPackageConfig, LoggingConfig, LogLevel, LogMeta } from './types';

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
  // Resolve configuration with defaults
  const resolved: Required<Omit<LoggingConfig, 'customLogger' | 'unifiedLogger'>> & {
    customLogger?: any;
    unifiedLogger?: any;
  } = {
    logToConsole: userConfig?.logToConsole ?? true,
    logToFile: userConfig?.logToFile ?? false,
    logFilePath: userConfig?.logFilePath ?? '',
    logLevel: userConfig?.logLevel ?? 'info',
    logFormat: userConfig?.logFormat ?? 'text',
    enableUnifiedLogger: userConfig?.enableUnifiedLogger ?? false,
    unifiedLogger: userConfig?.unifiedLogger ?? {},
    defaultSource: userConfig?.defaultSource ?? 'application',
    customLogger: userConfig?.customLogger
  };

  const sinks: any = {};

  // Console sink (existing behavior)
  if (resolved.logToConsole) {
    sinks.console = (level: LogLevel, msg: string, meta?: LogMeta) => {
      if (resolved.logFormat === 'json') {
        // Keep v1 JSON structure stable; add source/correlation when present
        const payload: any = {
          timestamp: new Date().toISOString(),
          package: packageConfig.packageName,
          level: level.toUpperCase(),
          message: msg,
          data: meta ? { ...meta } : undefined
        };
        // Avoid nesting _routing/noise into "data" twice
        if (meta?._routing) {
          delete payload.data._routing;
        }
        console.log(JSON.stringify(payload));
      } else {
        const ts = new Date().toISOString();
        const src = meta?.source ? `[${meta.source}] ` : '';
        const tail = meta ? ' ' + JSON.stringify(meta) : '';
        // Text format from v1 preserved, with optional source
        console.log(`[${ts}] [${packageConfig.packageName}] [${level.toUpperCase()}] ${src}${msg}${tail}`);
      }
    };
  }

  // File sink (existing behavior preserved)
  if (resolved.logToFile && resolved.logFilePath) {
    sinks.file = (level: LogLevel, msg: string, meta?: LogMeta) => {
      try {
        const ts = new Date().toISOString();
        const src = meta?.source ? `[${meta.source}] ` : '';
        const tail = meta ? ' ' + JSON.stringify(meta) : '';
        const formatted = `[${ts}] [${packageConfig.packageName}] [${level.toUpperCase()}] ${src}${msg}${tail}`;
        
        const dir = require('path').dirname(resolved.logFilePath);
        if (!require('fs').existsSync(dir)) {
          require('fs').mkdirSync(dir, { recursive: true });
        }
        
        require('fs').appendFileSync(resolved.logFilePath, formatted + '\n', 'utf8');
      } catch (err) {
        console.error(`[logs-gateway] ${packageConfig.packageName}: Failed to write to log file:`, err);
      }
    };
  }

  // Unified-logger (NEW, optional)
  if (resolved.enableUnifiedLogger) {
    sinks.unified = new UnifiedLoggerOutput(resolved.unifiedLogger!);
  }

  return new LogsGateway(packageConfig, resolved, sinks);
}

// Default export for convenience
export default {
  createLogger,
  LogsGateway
};