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
  LogMeta,
  LogEnvelope,
  ShadowController
} from './types';
import { UnifiedLoggerOutput } from './outputs/unified-logger-output';
import { LogSanitizer } from './sanitizer';
import { formatLogEntryAsYaml } from './formatters/yaml-formatter';
import { ShadowSink } from './outputs/shadow-sink';

/**
 * Main LogsGateway class for handling all logging operations
 */
export class LogsGateway {
  private config: InternalLoggingConfig;
  private packageConfig: LoggerPackageConfig;
  private sanitizer: LogSanitizer;
  private shadowSink?: ShadowSink;
  public readonly shadow: ShadowController;
  private levelPriority: Record<LogLevel, number> = {
    verbose: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
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
                (debugEnabled ? 'verbose' : 'info'),
     
      logFormat: userConfig?.logFormat ??
                 (process.env[`${envPrefix}_LOG_FORMAT`] as LogFormat) ??
                 'text',
     
      enableUnifiedLogger: userConfig?.enableUnifiedLogger ??
                          (process.env[`${envPrefix}_LOG_TO_UNIFIED`] === 'true'),

      unifiedLogger: userConfig?.unifiedLogger ?? {},

      defaultSource: userConfig?.defaultSource ?? 'application',

      sanitization: {
        // Default: completely disabled
        enabled: userConfig?.sanitization?.enabled ?? 
                 (process.env[`${envPrefix}_SANITIZE_ENABLED`] === 'true'),
        // Only set other options if sanitization is enabled
        ...(userConfig?.sanitization?.enabled || process.env[`${envPrefix}_SANITIZE_ENABLED`] === 'true' ? {
          maskWith: userConfig?.sanitization?.maskWith ?? 
                    process.env[`${envPrefix}_SANITIZE_MASK`] ?? 
                    '[REDACTED]',
          partialMaskRatio: userConfig?.sanitization?.partialMaskRatio ?? 
                           parseFloat(process.env[`${envPrefix}_SANITIZE_PARTIAL_RATIO`] ?? '1.0'),
          maxDepth: userConfig?.sanitization?.maxDepth ?? 
                   parseInt(process.env[`${envPrefix}_SANITIZE_MAX_DEPTH`] ?? '5'),
          keysDenylist: userConfig?.sanitization?.keysDenylist ?? 
                       (process.env[`${envPrefix}_SANITIZE_KEYS_DENYLIST`]?.split(',').map(k => k.trim()) ?? 
                        ['authorization', 'token', 'secret', 'api_key', 'passwd', 'password']),
          keysAllowlist: userConfig?.sanitization?.keysAllowlist ?? 
                        (process.env[`${envPrefix}_SANITIZE_KEYS_ALLOWLIST`]?.split(',').map(k => k.trim()) ?? []),
          fieldsHashInsteadOfMask: userConfig?.sanitization?.fieldsHashInsteadOfMask ?? 
                                  (process.env[`${envPrefix}_SANITIZE_FIELDS_HASH`]?.split(',').map(k => k.trim()) ?? []),
          detectEmails: userConfig?.sanitization?.detectEmails ?? 
                       (process.env[`${envPrefix}_SANITIZE_DETECT_EMAILS`] !== 'false'),
          detectIPs: userConfig?.sanitization?.detectIPs ?? 
                    (process.env[`${envPrefix}_SANITIZE_DETECT_IPS`] !== 'false'),
          detectPhoneNumbers: userConfig?.sanitization?.detectPhoneNumbers ?? 
                             (process.env[`${envPrefix}_SANITIZE_DETECT_PHONES`] !== 'false'),
          detectJWTs: userConfig?.sanitization?.detectJWTs ?? 
                     (process.env[`${envPrefix}_SANITIZE_DETECT_JWTS`] !== 'false'),
          detectAPIKeys: userConfig?.sanitization?.detectAPIKeys ?? 
                        (process.env[`${envPrefix}_SANITIZE_DETECT_APIKEYS`] !== 'false'),
          detectAWSCreds: userConfig?.sanitization?.detectAWSCreds ?? 
                         (process.env[`${envPrefix}_SANITIZE_DETECT_AWSCREDS`] !== 'false'),
          detectAzureKeys: userConfig?.sanitization?.detectAzureKeys ?? 
                          (process.env[`${envPrefix}_SANITIZE_DETECT_AZUREKEYS`] !== 'false'),
          detectGCPKeys: userConfig?.sanitization?.detectGCPKeys ?? 
                        (process.env[`${envPrefix}_SANITIZE_DETECT_GCPKEYS`] !== 'false'),
          detectPasswords: userConfig?.sanitization?.detectPasswords ?? 
                          (process.env[`${envPrefix}_SANITIZE_DETECT_PASSWORDS`] !== 'false'),
          detectCreditCards: userConfig?.sanitization?.detectCreditCards ?? 
                            (process.env[`${envPrefix}_SANITIZE_DETECT_CREDITCARDS`] !== 'false')
        } : {})
      },

      packageName: packageConfig.packageName,
      ...(userConfig?.customLogger && { customLogger: userConfig.customLogger }),
      shadow: this.parseShadowConfig(envPrefix, userConfig?.shadow)
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

    // Initialize sanitizer
    this.sanitizer = new LogSanitizer(this.config.sanitization);

    // Initialize shadow sink if enabled
    if (this.config.shadow?.enabled) {
      this.shadowSink = new ShadowSink(this.config.shadow, packageConfig.packageName);
      this.shadow = this.shadowSink;
    } else {
      // No-op controller when shadow is disabled
      this.shadow = this.createNoOpController();
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Parse shadow configuration from user config and environment variables
   */
  private parseShadowConfig(envPrefix: string, userShadow?: any): any {
    if (!userShadow && process.env[`${envPrefix}_SHADOW_ENABLED`] !== 'true') {
      return undefined;
    }

    return {
      enabled: userShadow?.enabled ?? (process.env[`${envPrefix}_SHADOW_ENABLED`] === 'true'),
      format: userShadow?.format ?? (process.env[`${envPrefix}_SHADOW_FORMAT`] as 'json' | 'yaml') ?? 'json',
      directory: userShadow?.directory ?? process.env[`${envPrefix}_SHADOW_DIR`] ?? './logs/shadow',
      ttlMs: userShadow?.ttlMs ?? parseInt(process.env[`${envPrefix}_SHADOW_TTL_MS`] ?? '86400000'),
      respectRoutingBlocks: userShadow?.respectRoutingBlocks ?? (process.env[`${envPrefix}_SHADOW_RESPECT_ROUTING`] !== 'false'),
      rollingBuffer: {
        maxEntries: userShadow?.rollingBuffer?.maxEntries ?? parseInt(process.env[`${envPrefix}_SHADOW_BUFFER_ENTRIES`] ?? '0'),
        maxAgeMs: userShadow?.rollingBuffer?.maxAgeMs ?? parseInt(process.env[`${envPrefix}_SHADOW_BUFFER_AGE_MS`] ?? '0')
      }
    };
  }

  /**
   * Create a no-op shadow controller for when shadow is disabled
   */
  private createNoOpController(): ShadowController {
    return {
      enable: () => {},
      disable: () => {},
      isEnabled: () => false,
      listActive: () => [],
      export: async () => { throw new Error('Shadow logging is not enabled'); },
      cleanupExpired: async () => 0
    };
  }

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
    // Check DEBUG environment variable override
    const debugEnabled = process.env.DEBUG?.includes(
      this.packageConfig.debugNamespace || this.packageConfig.packageName.toLowerCase()
    );
    
    // If DEBUG is enabled, allow verbose and debug levels regardless of configured level
    if (debugEnabled && (level === 'verbose' || level === 'debug')) {
      return true;
    }
    
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
    } else if (this.config.logFormat === 'yaml') {
      // Convert LogEntry to LogEnvelope format for YAML
      const envelope = {
        timestamp: logEntry.timestamp,
        package: logEntry.package,
        level: logEntry.level,
        message: logEntry.message,
        source: meta?.source ?? this.config.defaultSource ?? 'application',
        ...(logEntry.data && { data: logEntry.data }),
        // Include other metadata fields if present
        ...(meta?.correlationId && { correlationId: meta.correlationId }),
        ...(meta?.tags && { tags: meta.tags }),
        ...(meta?._routing && { _routing: meta._routing })
      };
      return formatLogEntryAsYaml(envelope);
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
    // Build envelope for shadow capture BEFORE sanitization and level filtering
    const timestamp = new Date().toISOString();
    const rawEnvelope: LogEnvelope = {
      timestamp,
      package: this.packageConfig.packageName,
      level: level.toUpperCase(),
      message,
      source: meta?.source ?? this.config.defaultSource ?? 'application',
      ...(meta && { data: meta }),
      // Extract known fields from meta
      ...(meta?.correlationId && { correlationId: meta.correlationId }),
      ...(meta?.jobId && { jobId: meta.jobId }),
      ...(meta?.runId && { runId: meta.runId }),
      ...(meta?.sessionId && { sessionId: meta.sessionId }),
      ...(meta?._routing && { _routing: meta._routing }),
      ...(meta?.tags && { tags: meta.tags })
    };

    // Shadow capture (raw, before sanitization, all levels)
    if (this.shadowSink) {
      this.shadowSink.write(rawEnvelope, meta);
    }

    // Check if we should log this level (for normal outputs)
    if (!this.shouldLog(level)) return;

    // Only sanitize if explicitly enabled
    let sanitizedMessage = message;
    let sanitizedMeta = meta;
    let sanitizationResult = { 
      sanitized: { message, data: meta }, 
      redactionCount: 0, 
      truncated: false 
    };

    if (this.config.sanitization.enabled) {
      sanitizationResult = this.sanitizer.sanitize(message, meta);
      sanitizedMessage = sanitizationResult.sanitized.message;
      sanitizedMeta = sanitizationResult.sanitized.data;
    }

    // Use custom logger if provided
    if (this.config.customLogger) {
      this.config.customLogger[level](sanitizedMessage, sanitizedMeta);
      return;
    }

    // Fill defaults without mutating caller object
    const enriched: LogMeta = {
      ...sanitizedMeta,
      source: sanitizedMeta?.source ?? this.config.defaultSource ?? 'application'
    };

    // Add sanitization metadata if any redactions occurred
    if (sanitizationResult.redactionCount > 0) {
      enriched._sanitization = {
        redactionCount: sanitizationResult.redactionCount,
        truncated: sanitizationResult.truncated
      };
    }

    // Console output
    if (this.config.logToConsole && this.shouldSend('console', enriched)) {
      if (this.sinks.console) {
        this.sinks.console(level, sanitizedMessage, enriched);
      } else {
        // Fallback to default console behavior
        const formattedMessage = this.formatLogEntry(level, sanitizedMessage, enriched);
        this.writeToConsole(level, formattedMessage);
      }
    }

    // File output
    if (this.config.logToFile && this.shouldSend('file', enriched)) {
      if (this.sinks.file) {
        this.sinks.file(level, sanitizedMessage, enriched);
      } else {
        // Fallback to default file behavior
        const formattedMessage = this.formatLogEntry(level, sanitizedMessage, enriched);
        this.writeToFile(formattedMessage);
      }
    }

    // Unified logger output
    if (this.config.enableUnifiedLogger && this.sinks.unified && this.shouldSend('unified-logger', enriched)) {
      this.sinks.unified.write(level, sanitizedMessage, enriched);
    }
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  /**
   * Log verbose message (only shown when logLevel is 'verbose' or 'debug')
   */
  verbose(message: string, data?: LogMeta): void {
    this.emit('verbose', message, data);
  }

  /**
   * Log debug message (only shown when logLevel is 'debug' or 'verbose')
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