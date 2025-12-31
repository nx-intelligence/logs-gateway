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
import { outputLogAsTable } from './formatters/table-formatter';
import { ShadowSink } from './outputs/shadow-sink';
import { detectAppInfo } from './app-info';
import { loadDebugConfig } from './utils/debug-config';

/**
 * Main LogsGateway class for handling all logging operations
 */
export class LogsGateway {
  private config: InternalLoggingConfig;
  private packageConfig: LoggerPackageConfig;
  private sanitizer: LogSanitizer;
  private shadowSink?: ShadowSink;
  public readonly shadow: ShadowController;
  private appInfo: { name?: string; version?: string };
  private debugScopingConfig: ReturnType<typeof loadDebugConfig>;
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
  private activeBetweenRanges: Set<number> = new Set(); // Tracks indices of active between rules

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
    // Automatically detect consuming application's package name and version
    this.appInfo = detectAppInfo();
    // Load debug scoping configuration from logger-debug.json
    this.debugScopingConfig = loadDebugConfig();
   
    // Check DEBUG environment variable
    const envPrefix = packageConfig.envPrefix || packageConfig.packageName;
    const debugEnabled = process.env.DEBUG?.includes(
      packageConfig.debugNamespace || packageConfig.packageName.toLowerCase()
    );
   
    // Parse console package filtering from env vars
    const parsePackageList = (envVar: string | undefined): string[] | undefined => {
      if (!envVar) return undefined;
      const packages = envVar.split(',').map(p => p.trim()).filter(p => p.length > 0);
      return packages.length > 0 ? packages : undefined;
    };
   
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
                (process.env[`${envPrefix}_LOG_LEVEL`] as LogLevel | undefined) ??
                (debugEnabled ? 'verbose' : 'info'),
     
      logFormat: userConfig?.logFormat ??
                 (process.env[`${envPrefix}_LOG_FORMAT`] as LogFormat) ??
                 'table',
     
      showFullTimestamp: userConfig?.showFullTimestamp ??
                        (process.env[`${envPrefix}_SHOW_FULL_TIMESTAMP`] === 'true'),
     
      consolePackagesShow: userConfig?.consolePackagesShow ?? parsePackageList(process.env[`${envPrefix}_CONSOLE_PACKAGES_SHOW`]),
      
      consolePackagesHide: userConfig?.consolePackagesHide ?? parsePackageList(process.env[`${envPrefix}_CONSOLE_PACKAGES_HIDE`]),
     
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
      shadow: this.parseShadowConfig(envPrefix, userConfig?.shadow),
      
      ...(userConfig?.debugScoping || this.debugScopingConfig ? {
        debugScoping: (userConfig?.debugScoping ?? this.debugScopingConfig)!
      } : {})
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
   * Check if a search string matches any identity in a list
   * 
   * @param searchString - The string to search for
   * @param identityList - List of identity patterns to match against
   * @param exactMatch - If true: exact match (case sensitive), if false: partial match (case insensitive)
   * @returns true if any identity in the list matches
   */
  private matchesIdentity(searchString: string, identityList: string[], exactMatch: boolean): boolean {
    if (!searchString || identityList.length === 0) {
      return false;
    }
    
    for (const identity of identityList) {
      if (exactMatch) {
        // Exact match (case sensitive)
        if (searchString === identity) {
          return true;
        }
      } else {
        // Partial match (case insensitive)
        if (searchString.toLowerCase().includes(identity.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Extract searchable text from log entry
   * Combines message, identity, and all meta fields (recursively stringified)
   * 
   * @param message - Log message
   * @param identity - Log identity
   * @param meta - Log metadata
   * @returns Combined searchable string
   */
  private getSearchableLogText(message: string, identity?: string, meta?: LogMeta): string {
    const parts: string[] = [];
    
    if (message) {
      parts.push(message);
    }
    
    if (identity) {
      parts.push(identity);
    }
    
    if (meta) {
      // Recursively stringify all meta fields
      try {
        const metaString = JSON.stringify(meta);
        parts.push(metaString);
      } catch (e) {
        // If stringification fails, try to stringify individual fields
        for (const [key, value] of Object.entries(meta)) {
          try {
            parts.push(`${key}:${JSON.stringify(value)}`);
          } catch (e2) {
            parts.push(`${key}:${String(value)}`);
          }
        }
      }
    }
    
    return parts.join(' ');
  }


  /**
   * Update the state of between ranges based on current log entry
   * 
   * @param message - Log message
   * @param identity - Log identity
   * @param meta - Log metadata
   */
  private updateBetweenRangeState(message: string, identity?: string, meta?: LogMeta): void {
    const scopingConfig = this.config.debugScoping || this.debugScopingConfig;
    
    // If no config or scoping is disabled, no between rules to process
    if (!scopingConfig || scopingConfig.scoping.status !== 'enabled') {
      return;
    }
    
    const betweenRules = scopingConfig.scoping.between;
    if (!betweenRules || betweenRules.length === 0) {
      return;
    }
    
    // Initialize ranges with empty startIdentities (ranges that start from beginning)
    // This ensures ranges with empty startIdentities are active from the start
    for (let i = 0; i < betweenRules.length; i++) {
      const rule = betweenRules[i];
      if (rule && rule.startIdentities.length === 0) {
        this.activeBetweenRanges.add(i);
      }
    }
    
    // Process each rule
    for (let i = 0; i < betweenRules.length; i++) {
      const rule = betweenRules[i];
      if (!rule) {
        continue;
      }
      
      const exactMatch = rule.exactMatch ?? false;
      const searchLog = rule.searchLog ?? false;
      
      // Determine what to search
      const searchText = searchLog 
        ? this.getSearchableLogText(message, identity, meta)
        : (identity || '');
      
      // Check if search text matches start identities
      const matchesStart = rule.startIdentities.length > 0 
        ? this.matchesIdentity(searchText, rule.startIdentities, exactMatch)
        : false;
      
      // Check if search text matches end identities
      const matchesEnd = rule.endIdentities.length > 0
        ? this.matchesIdentity(searchText, rule.endIdentities, exactMatch)
        : false;
      
      // Handle matching both start and end (treat as both start and end)
      if (matchesStart && matchesEnd) {
        // Toggle the range state
        if (this.activeBetweenRanges.has(i)) {
          this.activeBetweenRanges.delete(i);
        } else {
          this.activeBetweenRanges.add(i);
        }
      } else if (matchesStart) {
        // Activate range
        this.activeBetweenRanges.add(i);
      } else if (matchesEnd) {
        // Deactivate range (only if endIdentities is not empty)
        if (rule.endIdentities.length > 0) {
          this.activeBetweenRanges.delete(i);
        }
      }
      // Note: Empty endIdentities means range never closes, so we don't remove it
    }
  }

  /**
   * Check if a log should be included based on debug scoping configuration
   * Filters logs at runtime based on identity and application name
   * 
   * @param message - Log message
   * @param identity - Log identity (file:function format)
   * @param appName - Application name
   * @param meta - Log metadata
   * @returns true if log should be included, false if it should be filtered out
   */
  private shouldIncludeLog(message: string, identity?: string, appName?: string, meta?: LogMeta): boolean {
    // Use user-provided config if available, otherwise use loaded debug config
    const scopingConfig = this.config.debugScoping || this.debugScopingConfig;
    
    // If no config or scoping is disabled, include all logs
    if (!scopingConfig || scopingConfig.scoping.status !== 'enabled') {
      return true;
    }
    
    const { filterIdentities, filteredApplications, between } = scopingConfig.scoping;
    
    // Check existing filterIdentities/filteredApplications (OR logic)
    let matchesExistingFilter = false;
    const hasIdentityFilter = filterIdentities && filterIdentities.length > 0;
    const hasAppFilter = filteredApplications && filteredApplications.length > 0;
    
    if (hasIdentityFilter && identity) {
      if (filterIdentities!.includes(identity)) {
        matchesExistingFilter = true;
      }
    }
    
    if (hasAppFilter && appName) {
      if (filteredApplications!.includes(appName)) {
        matchesExistingFilter = true;
      }
    }
    
    // If no filters are configured (including between), include all logs
    if (!hasIdentityFilter && !hasAppFilter && (!between || between.length === 0)) {
      return true;
    }
    
    // Update between range state
    if (between && between.length > 0) {
      this.updateBetweenRangeState(message, identity, meta);
      
      // Check active between ranges
      let hasActiveIncludeRule = false;
      let hasActiveExcludeRule = false;
      
      for (const ruleIndex of this.activeBetweenRanges) {
        const rule = between[ruleIndex];
        if (!rule) {
          continue;
        }
        
        if (rule.action === 'include') {
          hasActiveIncludeRule = true;
        } else if (rule.action === 'exclude') {
          hasActiveExcludeRule = true;
        }
      }
      
      // Between rules use OR logic with existing filters
      // If ANY include rule is active, include the log
      if (hasActiveIncludeRule) {
        return true;
      }
      
      // If ANY exclude rule is active, exclude the log
      if (hasActiveExcludeRule) {
        return false;
      }
    }
    
    // If existing filters match, include the log
    if (matchesExistingFilter) {
      return true;
    }
    
    // No matches found - filter out the log
    return false;
  }

  /**
   * Check if a package should be shown in console output based on filtering rules
   * Only affects console output, not file or unified-logger
   */
  private shouldShowPackageInConsole(packageName: string): boolean {
    // If show list is defined, only show packages in that list
    if (this.config.consolePackagesShow && this.config.consolePackagesShow.length > 0) {
      return this.config.consolePackagesShow.includes(packageName);
    }
    
    // If hide list is defined, hide packages in that list
    if (this.config.consolePackagesHide && this.config.consolePackagesHide.length > 0) {
      return !this.config.consolePackagesHide.includes(packageName);
    }
    
    // Default: show all packages
    return true;
  }

  /**
   * Get call site identity from stack trace
   * Extracts file path and function name from the call stack
   * Returns a clean identity string like "src/file.ts:functionName" or "src/file.ts:lineNumber"
   */
  private getCallSiteIdentity(): string | undefined {
    try {
      const stack = new Error().stack;
      if (!stack) return undefined;

      const stackLines = stack.split('\n');
      
      // Skip the first line (Error message) and find the first caller outside logs-gateway
      for (let i = 1; i < stackLines.length; i++) {
        const line = stackLines[i]?.trim();
        if (!line) continue;
        
        // Skip logs-gateway internal files
        if (line.includes('logger.ts') || 
            line.includes('index.ts') || 
            line.includes('logs-gateway') ||
            line.includes('node_modules')) {
          continue;
        }

        // Parse stack line format: "at FunctionName (file:line:column)" or "at file:line:column"
        // Match patterns like:
        // - "at functionName (file:///path/to/file.ts:123:45)"
        // - "at file:///path/to/file.ts:123:45"
        // - "at Object.functionName (file:///path/to/file.ts:123:45)"
        const match = line.match(/at\s+(?:[^(]+\.)?([^(]+)\s*\(?([^:]+):(\d+):(\d+)\)?/);
        
        if (match && match[1] && match[2] && match[3]) {
          const functionName = match[1].trim();
          let filePath = match[2].trim();
          const lineNumber = match[3];

          // Clean up file path - remove file:// protocol and normalize
          filePath = filePath.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
          
          // Try to make path relative to process.cwd() for readability
          const cwd = process.cwd();
          if (filePath.startsWith(cwd)) {
            filePath = filePath.substring(cwd.length + 1);
          }

          // Remove node_modules from path if present
          const nodeModulesIndex = filePath.indexOf('node_modules');
          if (nodeModulesIndex !== -1) {
            // Keep only the package name and file after node_modules
            const afterNodeModules = filePath.substring(nodeModulesIndex + 'node_modules'.length + 1);
            const parts = afterNodeModules.split(/[/\\]/);
            if (parts.length >= 2) {
              filePath = `${parts[0]}/${parts.slice(1).join('/')}`;
            } else {
              filePath = afterNodeModules;
            }
          }

          // Normalize path separators
          filePath = filePath.replace(/\\/g, '/');

          // Format identity
          if (functionName && functionName !== 'Object' && functionName !== 'Module' && !functionName.startsWith('<')) {
            return `${filePath}:${functionName}`;
          } else {
            return `${filePath}:${lineNumber}`;
          }
        }
      }

      return undefined;
    } catch (error) {
      // If stack trace parsing fails, return undefined (no identity)
      return undefined;
    }
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
      ...(meta !== undefined && { data: meta }),
      ...(this.appInfo.name && { appName: this.appInfo.name }),
      ...(this.appInfo.version && { appVersion: this.appInfo.version })
    };

    if (this.config.logFormat === 'json') {
      // Include identity in JSON output if present
      const jsonEntry: any = { ...logEntry };
      if (meta?.identity) {
        jsonEntry.identity = meta.identity;
      }
      return JSON.stringify(jsonEntry);
    } else if (this.config.logFormat === 'yaml') {
      // Convert LogEntry to LogEnvelope format for YAML
      const envelope = {
        timestamp: logEntry.timestamp,
        package: logEntry.package,
        level: logEntry.level,
        message: logEntry.message,
        source: meta?.source ?? this.config.defaultSource ?? 'application',
        ...(logEntry.data && { data: logEntry.data }),
        ...(this.appInfo.name && { appName: this.appInfo.name }),
        ...(this.appInfo.version && { appVersion: this.appInfo.version }),
        // Include other metadata fields if present
        ...(meta?.identity && { identity: meta.identity }),
        ...(meta?.correlationId && { correlationId: meta.correlationId }),
        ...(meta?.tags && { tags: meta.tags }),
        ...(meta?._routing && { _routing: meta._routing })
      };
      return formatLogEntryAsYaml(envelope);
    } else if (this.config.logFormat === 'table') {
      // Table format is handled directly in writeToConsole, but provide a fallback string
      // This should not be called for console output, but may be used for file output
      let formatted = `[${timestamp}] [${this.packageConfig.packageName}] [${level.toUpperCase()}] ${message}`;
      if (meta !== undefined) {
        formatted += ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}`;
      }
      return formatted;
    } else {
      // Text format: [timestamp] [PACKAGE] [LEVEL] message
      let formatted = `[${timestamp}] [${this.packageConfig.packageName}] [${level.toUpperCase()}] ${message}`;
      if (meta !== undefined) {
        // Include identity in text format if present
        if (meta.identity) {
          formatted += ` [identity:${meta.identity}]`;
        }
        formatted += ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}`;
      }
      return formatted;
    }
  }

  /**
   * Write formatted message to console
   */
  private writeToConsole(level: LogLevel, formattedMessage: string, meta?: LogMeta): void {
    if (!this.config.logToConsole) return;

    // Handle table format specially
    if (this.config.logFormat === 'table') {
      const timestamp = new Date().toISOString();
      const envelope: LogEnvelope = {
        timestamp,
        package: this.packageConfig.packageName,
        level: level.toUpperCase(),
        message: formattedMessage,
        source: meta?.source ?? this.config.defaultSource ?? 'application',
        ...(meta !== undefined && { data: meta }),
        ...(this.appInfo.name && { appName: this.appInfo.name }),
        ...(this.appInfo.version && { appVersion: this.appInfo.version }),
        ...(meta?.correlationId && { correlationId: meta.correlationId }),
        ...(meta?.jobId && { jobId: meta.jobId }),
        ...(meta?.runId && { runId: meta.runId }),
        ...(meta?.sessionId && { sessionId: meta.sessionId }),
        ...(meta?.tags && { tags: meta.tags })
      };
      outputLogAsTable(envelope, this.config.showFullTimestamp);
      return;
    }

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
    // Get identity - use provided identity or auto-generate from call site
    const identity = meta?.identity ?? this.getCallSiteIdentity();
    
    // Apply debug scoping filter - if log doesn't match filters, skip all outputs
    if (!this.shouldIncludeLog(message, identity, this.appInfo.name, meta)) {
      return; // Filter out this log completely
    }
    
    // Build envelope for shadow capture BEFORE sanitization and level filtering
    const timestamp = new Date().toISOString();
    const rawEnvelope: LogEnvelope = {
      timestamp,
      package: this.packageConfig.packageName,
      level: level.toUpperCase(),
      message,
      source: meta?.source ?? this.config.defaultSource ?? 'application',
      ...(meta && { data: meta }),
      ...(this.appInfo.name && { appName: this.appInfo.name }),
      ...(this.appInfo.version && { appVersion: this.appInfo.version }),
      // Extract known fields from meta
      ...(identity && { identity }),
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
      source: sanitizedMeta?.source ?? this.config.defaultSource ?? 'application',
      ...(identity && { identity })
    };

    // Add sanitization metadata if any redactions occurred
    if (sanitizationResult.redactionCount > 0) {
      enriched._sanitization = {
        redactionCount: sanitizationResult.redactionCount,
        truncated: sanitizationResult.truncated
      };
    }

    // Console output
    // Apply package filtering for console (only affects console, not file/unified)
    if (this.config.logToConsole && this.shouldSend('console', enriched) && this.shouldShowPackageInConsole(this.packageConfig.packageName)) {
      if (this.sinks.console) {
        this.sinks.console(level, sanitizedMessage, enriched);
      } else {
        // Fallback to default console behavior
        const formattedMessage = this.formatLogEntry(level, sanitizedMessage, enriched);
        this.writeToConsole(level, formattedMessage, enriched);
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