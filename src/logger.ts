/**
 * logs-gateway - Core LogsGateway Implementation
 * 
 * This file contains the main LogsGateway class that handles all logging functionality.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LogLevel,
  LogFormat,
  LoggingConfig,
  LoggerPackageConfig,
  LogEntry,
  InternalLoggingConfig,
  LogMeta
} from './types';
import { UnifiedLoggerOutput } from './outputs/unified-logger-output';

/**
 * Main LogsGateway class for handling all logging operations
 */
export class LogsGateway {
  private config: InternalLoggingConfig;
  private packageConfig: LoggerPackageConfig;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  private sinks: {
    console?: (level: LogLevel, msg: string, meta?: LogMeta) => void;
    file?: (level: LogLevel, msg: string, meta?: LogMeta) => void;
    unified?: UnifiedLoggerOutput;
  };

  constructor(
    packageConfig: LoggerPackageConfig, 
    userConfig?: LoggingConfig,
    sinks?: {
      console?: (level: LogLevel, msg: string, meta?: LogMeta) => void;
      file?: (level: LogLevel, msg: string, meta?: LogMeta) => void;
      unified?: UnifiedLoggerOutput;
    }
  ) {
    this.packageConfig = packageConfig;
    this.sinks = sinks || {};
   
    // Check DEBUG environment variable
    const envPrefix = packageConfig.envPrefix || packageConfig.packageName;
    const debugEnabled = process.env.DEBUG?.includes(
      packageConfig.debugNamespace || packageConfig.packageName.toLowerCase()
    );
   
    // Build configuration with precedence: user config > env vars > defaults
    this.config = {
      logToConsole: userConfig?.logToConsole ??
                    (process.env[`${envPrefix}_LOG_TO_CONSOLE`] !== 'false'),
     
      logToFile: userConfig?.logToFile ??
                 (process.env[`${envPrefix}_LOG_TO_FILE`] === 'true'),
     
      logFilePath: userConfig?.logFilePath ??
                   process.env[`${envPrefix}_LOG_FILE`] ??
                   '',
     
      logLevel: userConfig?.logLevel ??
                (process.env[`${envPrefix}_LOG_LEVEL`] as LogLevel) ??
                (debugEnabled ? 'debug' : 'info'),
     
      logFormat: userConfig?.logFormat ??
                 (process.env[`${envPrefix}_LOG_FORMAT`] as LogFormat) ??
                 'text',
     
      enableUnifiedLogger: userConfig?.enableUnifiedLogger ??
                          (process.env[`${envPrefix}_LOG_TO_UNIFIED`] === 'true'),

      unifiedLogger: userConfig?.unifiedLogger ?? {},

      defaultSource: userConfig?.defaultSource ?? 'application',

      packageName: packageConfig.packageName,
      ...(userConfig?.customLogger && { customLogger: userConfig.customLogger })
    };

    // Validate configuration
    if (this.config.logToFile && !this.config.logFilePath) {
      throw new Error(
        `[logs-gateway] ${packageConfig.packageName}: logFilePath is required when logToFile is true. ` +
        `Set it via config or ${envPrefix}_LOG_FILE environment variable.`
      );
    }

    // Ensure log directory exists if file logging is enabled
    if (this.config.logToFile && this.config.logFilePath) {
      this.ensureLogDirectory(this.config.logFilePath);
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Ensure the log directory exists, creating it if necessary
   */
  private ensureLogDirectory(filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error(
        `[logs-gateway] ${this.packageConfig.packageName}: Failed to create log directory:`,
        err
      );
    }
  }

  /**
   * Check if a log level should be output based on current configuration
   */
  private shouldLog(level: LogLevel): boolean {
    const currentLevelPriority = this.levelPriority[this.config.logLevel];
    const messageLevelPriority = this.levelPriority[level];
    return messageLevelPriority >= currentLevelPriority;
  }

  /**
   * Check if a specific output should receive the log based on routing metadata
   */
  private shouldSend(outputName: 'console' | 'file' | 'unified-logger', meta?: LogMeta): boolean {
    // Block/allow by metadata
    if (meta?._routing?.blockOutputs?.includes(outputName)) {
      return false;
    }
    if (meta?._routing?.allowedOutputs && !meta._routing.allowedOutputs.includes(outputName)) {
      return false;
    }
    
    // Safety: gateway internal logs never escape to unified-logger
    if (meta?.source === 'logs-gateway-internal' && outputName === 'unified-logger') {
      return false;
    }
    
    return true;
  }

  /**
   * Format a log entry according to the configured format
   */
  private formatLogEntry(level: LogLevel, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      package: this.packageConfig.packageName,
      level: level.toUpperCase(),
      message,
      ...(meta !== undefined && { data: meta })
    };

    if (this.config.logFormat === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // Text format: [timestamp] [PACKAGE] [LEVEL] message
      let formatted = `[${timestamp}] [${this.packageConfig.packageName}] [${level.toUpperCase()}] ${message}`;
      if (meta !== undefined) {
        formatted += ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}`;
      }
      return formatted;
    }
  }

  /**
   * Write formatted message to console
   */
  private writeToConsole(level: LogLevel, formattedMessage: string): void {
    if (!this.config.logToConsole) return;

    if (level === 'error') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * Write formatted message to log file
   */
  private writeToFile(formattedMessage: string): void {
    if (!this.config.logToFile || !this.config.logFilePath) return;

    try {
      fs.appendFileSync(this.config.logFilePath, formattedMessage + '\n', 'utf8');
    } catch (err) {
      // Fallback to console if file write fails
      console.error(
        `[logs-gateway] ${this.packageConfig.packageName}: Failed to write to log file (${this.config.logFilePath}):`,
        err
      );
    }
  }

  /**
   * Core logging method that handles all log output
   */
  private emit(level: LogLevel, message: string, meta?: LogMeta): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) return;

    // Use custom logger if provided
    if (this.config.customLogger) {
      this.config.customLogger[level](message, meta);
      return;
    }

    // Fill defaults without mutating caller object
    const enriched: LogMeta = {
      ...meta,
      source: meta?.source ?? this.config.defaultSource ?? 'application'
    };

    // Console output
    if (this.config.logToConsole && this.shouldSend('console', enriched)) {
      if (this.sinks.console) {
        this.sinks.console(level, message, enriched);
      } else {
        // Fallback to default console behavior
        const formattedMessage = this.formatLogEntry(level, message, enriched);
        this.writeToConsole(level, formattedMessage);
      }
    }

    // File output
    if (this.config.logToFile && this.shouldSend('file', enriched)) {
      if (this.sinks.file) {
        this.sinks.file(level, message, enriched);
      } else {
        // Fallback to default file behavior
        const formattedMessage = this.formatLogEntry(level, message, enriched);
        this.writeToFile(formattedMessage);
      }
    }

    // Unified logger output
    if (this.config.enableUnifiedLogger && this.sinks.unified && this.shouldSend('unified-logger', enriched)) {
      this.sinks.unified.write(level, message, enriched);
    }
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  /**
   * Log debug message (only shown when logLevel is 'debug')
   */
  debug(message: string, data?: LogMeta): void {
    this.emit('debug', message, data);
  }

  /**
   * Log informational message
   */
  info(message: string, data?: LogMeta): void {
    this.emit('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: LogMeta): void {
    this.emit('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: LogMeta): void {
    this.emit('error', message, data);
  }

  /**
   * Log success message (maps to INFO level)
   */
  success(message: string, data?: LogMeta): void {
    this.emit('info', message, data);
  }

  /**
   * Get current logger configuration (for debugging/testing)
   */
  getConfig(): Readonly<InternalLoggingConfig> {
    return { ...this.config };
  }

  /**
   * Check if a specific log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }
}