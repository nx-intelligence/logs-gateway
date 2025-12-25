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
  SanitizationConfig,
  CustomLogger,
  LoggerPackageConfig,
  LogEntry,
  InternalLoggingConfig,
  LogMeta,
  RoutingMeta,
  UnifiedLoggerConfig,
  UnifiedLoggerTransports,
  ShadowConfig,
  ShadowController
} from './types';

// Re-export the LogsGateway class
export { LogsGateway } from './logger';

// Import LogsGateway for the factory function
import { LogsGateway } from './logger';
import { UnifiedLoggerOutput } from './outputs/unified-logger-output';
import { formatLogEntryAsYaml } from './formatters/yaml-formatter';
import { outputLogAsTable } from './formatters/table-formatter';
import { detectAppInfo } from './app-info';
import type { LoggerPackageConfig, LoggingConfig, LogLevel, LogMeta, LogEnvelope, TransportsConfig, TracingConfig, TrailsConfig } from './types';

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
 * // Zero-config mode (ERC 2.0): Auto-discovers from environment variables
 * const logger = createLogger(
 *   { packageName: 'MY_APP', envPrefix: 'MY_APP', debugNamespace: 'my-app' }
 * );
 *
 * // Advanced mode: Explicit configuration
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
  const resolved: Required<Omit<LoggingConfig, 'customLogger' | 'unifiedLogger' | 'transports' | 'tracing' | 'trails' | 'schemaCheck' | 'shadow'>> & {
    customLogger?: any;
    unifiedLogger?: any;
    transports?: TransportsConfig | undefined;
    tracing?: TracingConfig | undefined;
    trails?: TrailsConfig | undefined;
    schemaCheck?: { enabled?: boolean };
    shadow?: any;
  } = {
    logToConsole: userConfig?.logToConsole ?? true,
    logToFile: userConfig?.logToFile ?? false,
    logFilePath: userConfig?.logFilePath ?? '',
    logLevel: userConfig?.logLevel ?? 'info',
    logFormat: userConfig?.logFormat ?? 'table', // Default to table format
    enableUnifiedLogger: userConfig?.enableUnifiedLogger ?? false,
    unifiedLogger: userConfig?.unifiedLogger ?? {},
    defaultSource: userConfig?.defaultSource ?? 'application',
    sanitization: userConfig?.sanitization ?? {},
    customLogger: userConfig?.customLogger,
    transports: userConfig?.transports ?? undefined,
    tracing: userConfig?.tracing ?? undefined,
    trails: userConfig?.trails ?? undefined,
    schemaCheck: userConfig?.schemaCheck ?? { enabled: false },
    shadow: userConfig?.shadow ?? undefined
  };

  const sinks: any = {};
  
  // Automatically detect consuming application's package name and version
  const appInfo = detectAppInfo();

  // Console sink (existing behavior)
  // Priority order: table (default) → yaml → json → text
  if (resolved.logToConsole) {
    sinks.console = (level: LogLevel, msg: string, meta?: LogMeta) => {
      if (resolved.logFormat === 'table') {
        // Table format (default): create envelope and output as table
        const envelope: LogEnvelope = {
          timestamp: new Date().toISOString(),
          package: packageConfig.packageName,
          level: level.toUpperCase(),
          message: msg,
          source: meta?.source ?? resolved.defaultSource ?? 'application',
          ...(meta && { data: meta }),
          ...(appInfo.name && { appName: appInfo.name }),
          ...(appInfo.version && { appVersion: appInfo.version }),
          // Include other metadata fields if present
          ...(meta?.correlationId && { correlationId: meta.correlationId }),
          ...(meta?.jobId && { jobId: meta.jobId }),
          ...(meta?.runId && { runId: meta.runId }),
          ...(meta?.sessionId && { sessionId: meta.sessionId }),
          ...(meta?.tags && { tags: meta.tags })
        };
        outputLogAsTable(envelope);
      } else if (resolved.logFormat === 'yaml') {
        // YAML format: create envelope and format as YAML
        const envelope: LogEnvelope = {
          timestamp: new Date().toISOString(),
          package: packageConfig.packageName,
          level: level.toUpperCase(),
          message: msg,
          source: meta?.source ?? resolved.defaultSource ?? 'application',
          ...(meta && { data: meta }),
          ...(appInfo.name && { appName: appInfo.name }),
          ...(appInfo.version && { appVersion: appInfo.version }),
          // Include other metadata fields if present
          ...(meta?.correlationId && { correlationId: meta.correlationId }),
          ...(meta?.tags && { tags: meta.tags }),
          ...(meta?._routing && { _routing: meta._routing })
        };
        console.log(formatLogEntryAsYaml(envelope));
      } else if (resolved.logFormat === 'json') {
        // JSON format: keep v1 JSON structure stable; add source/correlation when present
        const payload: any = {
          timestamp: new Date().toISOString(),
          package: packageConfig.packageName,
          level: level.toUpperCase(),
          message: msg,
          data: meta ? { ...meta } : undefined,
          ...(appInfo.name && { appName: appInfo.name }),
          ...(appInfo.version && { appVersion: appInfo.version })
        };
        // Avoid nesting _routing/noise into "data" twice
        if (meta?._routing) {
          delete payload.data._routing;
        }
        console.log(JSON.stringify(payload));
      } else {
        // Text format: fallback
        const ts = new Date().toISOString();
        const src = meta?.source ? `[${meta.source}] ` : '';
        const tail = meta ? ' ' + JSON.stringify(meta) : '';
        // Text format from v1 preserved, with optional source
        console.log(`[${ts}] [${packageConfig.packageName}] [${level.toUpperCase()}] ${src}${msg}${tail}`);
      }
    };
  }

  // File sink (existing behavior preserved)
  // Table format is console-only, so fall back to text for file output
  const fileFormat = resolved.logFormat === 'table' ? 'text' : resolved.logFormat;
  
  if (resolved.logToFile && resolved.logFilePath) {
    sinks.file = (level: LogLevel, msg: string, meta?: LogMeta) => {
      try {
        let formatted: string;
        
        if (fileFormat === 'json') {
          // JSON format for file
          const payload: any = {
            timestamp: new Date().toISOString(),
            package: packageConfig.packageName,
            level: level.toUpperCase(),
            message: msg,
            data: meta ? { ...meta } : undefined,
            ...(appInfo.name && { appName: appInfo.name }),
            ...(appInfo.version && { appVersion: appInfo.version })
          };
          if (meta?._routing) {
            delete payload.data._routing;
          }
          formatted = JSON.stringify(payload);
        } else if (fileFormat === 'yaml') {
          // YAML format: create envelope and format as YAML
          const envelope: LogEnvelope = {
            timestamp: new Date().toISOString(),
            package: packageConfig.packageName,
            level: level.toUpperCase(),
            message: msg,
            source: meta?.source ?? resolved.defaultSource ?? 'application',
            ...(meta && { data: meta }),
            ...(appInfo.name && { appName: appInfo.name }),
            ...(appInfo.version && { appVersion: appInfo.version }),
            // Include other metadata fields if present
            ...(meta?.correlationId && { correlationId: meta.correlationId }),
            ...(meta?.tags && { tags: meta.tags }),
            ...(meta?._routing && { _routing: meta._routing })
          };
          formatted = formatLogEntryAsYaml(envelope);
        } else {
          // Text format (default fallback, including when table is specified)
          const ts = new Date().toISOString();
          const src = meta?.source ? `[${meta.source}] ` : '';
          const tail = meta ? ' ' + JSON.stringify(meta) : '';
          formatted = `[${ts}] [${packageConfig.packageName}] [${level.toUpperCase()}] ${src}${msg}${tail}`;
        }
        
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

  return new LogsGateway(packageConfig, userConfig, sinks);
}

// Default export for convenience
export default {
  createLogger,
  LogsGateway
};
