/**
 * logs-gateway - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the logs gateway package.
 */

/**
 * Supported log levels in order of priority
 */
export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Output format options for log entries
 */
export type LogFormat = 'text' | 'json' | 'yaml';

/**
 * Configuration for PII/credentials sanitization
 */
export interface SanitizationConfig {
  /** Enable sanitization (default: false) */
  enabled?: boolean;
  
  /** Detector toggles (all default true when enabled) */
  detectEmails?: boolean;
  detectIPs?: boolean;
  detectPhoneNumbers?: boolean;
  detectJWTs?: boolean;
  detectAPIKeys?: boolean;
  detectAWSCreds?: boolean;
  detectAzureKeys?: boolean;
  detectGCPKeys?: boolean;
  detectPasswords?: boolean;
  detectCreditCards?: boolean;
  
  /** Behavior settings */
  maskWith?: string;               // default: "[REDACTED]"
  partialMaskRatio?: number;       // e.g., 0.7 keep 30% tail; default: 1.0 (full)
  maxDepth?: number;               // JSON scan depth; default: 5
  keysDenylist?: string[];         // exact/lowercased keys to force mask
  keysAllowlist?: string[];        // keys to skip masking (strongly discouraged)
  fieldsHashInsteadOfMask?: string[]; // keys to hash (sha256) instead of mask
}

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

  /** PII/credentials sanitization configuration */
  sanitization?: SanitizationConfig;

  /** Transport configuration */
  transports?: TransportsConfig;

  /** Tracing configuration */
  tracing?: TracingConfig;

  /** Trails configuration */
  trails?: TrailsConfig;

  /** Schema validation configuration */
  schemaCheck?: {
    enabled?: boolean;
  };
}

/**
 * Custom logger interface for injecting external loggers (Winston, Pino, etc.)
 */
export interface CustomLogger {
  verbose: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
  success: (message: string, data?: any) => void;
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
  level?: 'verbose' | 'debug' | 'info' | 'warn' | 'error';
  transports?: UnifiedLoggerTransports;
  
  /** Optional level filter for this output */
  levels?: LogLevel[];
}

/**
 * Internal configuration type with all required fields
 */
export type InternalLoggingConfig = Required<Omit<LoggingConfig, 'customLogger' | 'unifiedLogger' | 'transports' | 'tracing' | 'trails' | 'schemaCheck'>> & { 
  customLogger?: CustomLogger;
  unifiedLogger?: UnifiedLoggerConfig;
  packageName: string;
  transports?: TransportsConfig;
  tracing?: TracingConfig;
  trails?: TrailsConfig;
  schemaCheck?: { enabled?: boolean };
};

/**
 * Trails configuration for operation and thread tracking
 */
export interface TrailsConfig {
  /** Enable depth/operation trail tracking */
  enableDepthTrail?: boolean;
  /** Enable thread/causal trail tracking */
  enableThreadTrail?: boolean;
  /** Inject trail headers on outbound requests */
  injectHeaders?: boolean;
  /** Extract trail headers from inbound requests */
  extractHeaders?: boolean;
  /** Maximum sequence number window for thread tracking */
  sequenceWindow?: number;
}

/**
 * Transport configuration options
 */
export interface TransportsConfig {
  /** Core logging transport: pino (high-perf) or builtin (fallback) */
  core?: 'pino' | 'builtin';
  /** File rotation strategy: winston (daily), rfs (size/interval), or none */
  fileRotation?: 'winston' | 'rfs' | 'none';
  /** Enable pretty output in development */
  devPretty?: boolean;
}

/**
 * Tracing configuration for OpenTelemetry integration
 */
export interface TracingConfig {
  /** Enable OpenTelemetry context integration (no-op if @opentelemetry/api not available) */
  enableOtelContext?: boolean;
}

/**
 * Operation context for depth trail tracking
 */
export interface OperationCtx {
  /** Unique operation identifier */
  operationId: string;
  /** Parent operation identifier */
  parentOperationId?: string | undefined;
  /** Human-readable operation name */
  operationName: string;
  /** Hierarchical operation path */
  operationPath: string;
  /** Step number within operation */
  operationStep: number;
  /** Trace identifier */
  traceId: string;
  /** Span identifier */
  spanId: string;
}

/**
 * Thread context for causal trail tracking
 */
export interface ThreadContext {
  /** Unique thread identifier */
  threadId: string;
  /** Current event identifier */
  eventId: string;
  /** Causation chain (events that caused this one) */
  causationId?: string | string[] | undefined;
  /** Sequence number within thread */
  sequenceNo: number;
  /** Partition key for distributed processing */
  partitionKey?: string | undefined;
  /** Retry attempt number */
  attempt?: number | undefined;
  /** Shard identifier */
  shardId?: string | undefined;
  /** Worker identifier */
  workerId?: string | undefined;
}

/**
 * Normalized log envelope structure
 */
export interface LogEnvelope {
  /** ISO timestamp */
  timestamp: string;
  /** Package name */
  package: string;
  /** Log level */
  level: string;
  /** Log message */
  message: string;
  /** Source identifier */
  source: string;
  /** Sanitized payload data */
  data?: any;

  // Job/correlation fields
  /** Correlation identifier */
  correlationId?: string;
  /** Job identifier */
  jobId?: string;
  /** Run identifier */
  runId?: string;
  /** Session identifier */
  sessionId?: string;

  // Depth trail (operation hierarchy)
  /** Operation identifier */
  operationId?: string;
  /** Parent operation identifier */
  parentOperationId?: string;
  /** Operation name */
  operationName?: string;
  /** Operation path */
  operationPath?: string;
  /** Operation step */
  operationStep?: number;

  // Thread trail (causal chain)
  /** Thread identifier */
  threadId?: string;
  /** Event identifier */
  eventId?: string;
  /** Causation identifier(s) */
  causationId?: string | string[];
  /** Sequence number */
  sequenceNo?: number;
  /** Partition key */
  partitionKey?: string;
  /** Attempt number */
  attempt?: number;
  /** Shard identifier */
  shardId?: string;
  /** Worker identifier */
  workerId?: string;

  // Tracing fields
  /** Trace identifier */
  traceId?: string;
  /** Span identifier */
  spanId?: string;

  // Routing and metadata
  /** Routing metadata */
  _routing?: RoutingMeta;
  /** Free-form tags */
  tags?: string[];
}
