# logs-gateway

A standardized logging gateway for Node.js applications. Flexible multi-transport logging with **console**, **file**, and **unified-logger** outputs; **ENV-first** configuration; **PII/credentials sanitization**; **dual correlation trails** (operation & thread); **OpenTelemetry** context; **YAML/JSON/text** formats; **per-run "Shadow Logging"** for test/debug capture; **scoping** with text filters; **story output** powered by `scopeRecord`; and **troubleshooting integration** with `nx-troubleshooting`.

## Features

* ✅ Console output (default)
* ✅ File output (optional)
* ✅ Unified-logger output (Papertrail/UDP/Console via `@x-developer/unified-logger`)
* ✅ Dual/triple output (console + file + unified-logger)
* ✅ Environment variable configuration
* ✅ Custom logger injection (Winston, Pino, etc.)
* ✅ Package-specific prefixes
* ✅ **Five log levels**: `verbose`, `debug`, `info`, `warn`, `error`
* ✅ **Multiple formats**: `text`, `json`, `yaml` (console & file; unified stays JSON)
* ✅ **PII/Credentials sanitization** (auto-detect & mask, opt-in)
* ✅ **Dual trails**: operation (Depth) & thread (Causal), plus `runId`, `jobId`, `correlationId`, `sessionId`
* ✅ **OpenTelemetry context** (`traceId`, `spanId`) when available
* ✅ Routing metadata (control outputs per entry)
* ✅ Recursion safety (prevent circular/unified feedback)
* ✅ TypeScript support
* ✅ **Shadow Logging (per-run capture)** with TTL & forced-verbose, great for tests
* ✅ **Scoping** – Derive focused subsets of logs with text filters and correlation keys
* ✅ **Story Output** – Human-readable narrative format built automatically from log entries
* ✅ **Troubleshooting Integration** – Wire in `nx-troubleshooting` for intelligent error-to-solution matching

---

## Installation

```bash
npm install logs-gateway
```

For troubleshooting integration:

```bash
npm install logs-gateway nx-troubleshooting
```

---

## Quick Start

```ts
import { createLogger } from 'logs-gateway';

const logger = createLogger(
  { packageName: 'MY_APP', envPrefix: 'MY_APP' },
  {
    logToFile: true,
    logFilePath: '/var/log/myapp.log',
    logLevel: 'info',            // verbose|debug|info|warn|error
    logFormat: 'json',           // text|json|yaml (yaml: console/file only)
    enableUnifiedLogger: true,
    unifiedLogger: {
      transports: { papertrail: true },
      service: 'my-app',
      env: 'production'
    },
    // Optional: per-run Shadow Logging defaults (can also be enabled at runtime)
    shadow: { enabled: false, ttlMs: 86_400_000 }, // 1 day
    // Optional: Scoping & Troubleshooting
    scoping: {
      enabled: true,
      errorScoping: { enabled: true, windowMsBefore: 60_000, windowMsAfter: 30_000 },
      buffer: { maxEntries: 5000, preferShadow: true }
    },
    troubleshooting: {
      enabled: true,
      narrativesPath: './metadata/troubleshooting.json',
      output: { formats: ['markdown'], emitAsLogEntry: true }
    }
  }
);

// Standard usage
logger.verbose('Very detailed info', { step: 'init' });
logger.debug('Debug info', { data: 'x' });
logger.info('Application initialized', { version: '1.0.0' });
logger.warn('Deprecated feature used');
logger.error('Error occurred', { error: new Error('boom') });
```

---

## Automatic Application Identification

**logs-gateway** automatically detects and includes your application's package name and version in every log entry. This is done by reading the consuming project's `package.json` file (the project using logs-gateway, not logs-gateway itself).

### How It Works

When you create a logger instance, logs-gateway automatically:
1. Searches up the directory tree from `process.cwd()` to find the nearest `package.json`
2. Extracts the `name` and `version` fields from that file
3. Includes them in all log entries as `appName` and `appVersion`

This happens **automatically** - no configuration needed! The detection is cached after the first call for performance.

### Example

If your project's `package.json` contains:
```json
{
  "name": "my-awesome-app",
  "version": "2.1.0"
}
```

Then all log entries will automatically include:
```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "package": "MY_APP",
  "level": "INFO",
  "message": "Application initialized",
  "appName": "my-awesome-app",
  "appVersion": "2.1.0",
  "data": { ... }
}
```

### Benefits

- **Traceability**: Know exactly which application version generated each log entry
- **Debugging**: Filter logs by application version in centralized logging systems
- **Deployment Tracking**: Identify which deployments are running in production
- **Zero Configuration**: Works automatically without any API changes

### Important Notes

- The detection searches from `process.cwd()` (the working directory where your app runs)
- It stops at the first `package.json` that is not in `node_modules`
- If no `package.json` is found, `appName` and `appVersion` are simply omitted (no error)
- The result is cached after first detection for performance

---

## Overview: Scoping, Story Output & Troubleshooting

This extension adds three major capabilities:

1. **Scoping** – Given a verbose log stream, derive a **focused subset** of logs relevant to a problem or question. Scopes can be:
   * Error-centric (anchor on a specific `error` entry)
   * Run/Correlation-centric (anchor on `runId`, `correlationId`, etc.)
   * Text-based (filter by message/data content)
   * Narrative-based (optional, driven by "scoping narratives")

   Scoping **always uses verbose logs** if available, regardless of the current log level.

2. **Story vs Full Data Output** – A scope can be returned as:
   * **Full data**: structured `ScopedLogView` with all entries
   * **Story**: human-readable narrative built automatically from entries using a generic `scopeRecord` helper
   * Or **both**

3. **Troubleshooting Integration** – Wire in `nx-troubleshooting` so that errors/scopes:
   * Are matched to **troubleshooting narratives**, and
   * Produce troubleshooting artifacts (Markdown/JSON/text) as **another log output channel** (`troubleshooting`)

The same `scopeRecord` helper is also exported as a **generic tool** for scoping arbitrary JSON records (not just logs).

---

## Configuration

### Via Constructor

```ts
const logger = createLogger(
  { packageName: 'MY_PACKAGE', envPrefix: 'MY_PACKAGE', debugNamespace: 'my-pkg' },
  {
    // Outputs
    logToConsole: true,              // default: true
    logToFile: false,                // default: false
    logFilePath: '/var/log/app.log', // required if logToFile
    enableUnifiedLogger: false,      // default: false
    unifiedLogger: { /* ... */ },

    // Behavior
    logLevel: 'info',                // verbose|debug|info|warn|error (default: info)
    logFormat: 'text',               // text|json|yaml (default: text)
    defaultSource: 'application',    // fallback source tag

    // Sanitization (opt-in)
    sanitization: {
      enabled: false,                // default: false
      maskWith: '[REDACTED]',
      keysDenylist: ['authorization','password','secret','api_key'],
      fieldsHashInsteadOfMask: ['userId'],
      detectJWTs: true
      // + other detectors & guardrails
    },

    // Trails & tracing (optional; safe no-ops if not used)
    trails: {
      enableDepthTrail: true,        // operation trail
      enableThreadTrail: true,       // causal/thread trail
      injectHeaders: true,           // for HTTP/queues adapters
      extractHeaders: true
    },
    tracing: { enableOtelContext: true },

    // Shadow Logging (per-run capture; can also be toggled at runtime)
    shadow: {
      enabled: false,                // default: false
      format: 'json',                // json|yaml (default: json)
      directory: './logs/shadow',    // default path
      ttlMs: 86_400_000,             // 1 day
      forceVerbose: true,            // capture all levels for the runId
      respectRoutingBlocks: true,    // honor _routing.blockOutputs: ['shadow'|'file']
      includeRaw: false,             // also write unsanitized (dangerous; tests only)
      rollingBuffer: { maxEntries: 0, maxAgeMs: 0 } // optional retro-capture
    },

    // Scoping (opt-in)
    scoping: {
      enabled: false,                // default: false
      errorScoping: {
        enabled: true,               // default: true if scoping.enabled
        levels: ['error'],           // default: ['error']
        windowMsBefore: 30_000,     // default: 30_000
        windowMsAfter: 30_000        // default: 30_000
      },
      runScoping: {
        enabled: true,               // default: true if scoping.enabled
        defaultWindowMsBeforeFirstError: 60_000,
        defaultWindowMsAfterLastEntry: 30_000
      },
      narrativeScoping: {
        enabled: false,              // default: false
        narrativesPath: './metadata/log-scopes.json',
        envPrefix: 'NX_SCOPE'
      },
      buffer: {
        maxEntries: 0,               // default: 0 => disabled if Shadow is enough
        maxAgeMs: 0,
        includeLevels: ['verbose','debug','info','warn','error'],
        preferShadow: true           // default: true
      }
    },

    // Troubleshooting (opt-in, requires nx-troubleshooting)
    troubleshooting: {
      enabled: false,                // default: false
      narrativesPath: './metadata/troubleshooting.json',
      envPrefix: 'NX_TROUBLE',
      loggingConfig: { /* optional */ },
      engine: undefined,             // optional DI
      output: {
        formats: ['markdown'],       // default: ['markdown']
        writeToFileDir: undefined,
        attachToShadow: false,
        emitAsLogEntry: false,
        callback: undefined
      }
    }
  }
);
```

### Via Environment Variables

```bash
# Console & file
MY_APP_LOG_TO_CONSOLE=true|false
MY_APP_LOG_TO_FILE=true|false
MY_APP_LOG_FILE=/path/to/log

# Unified-logger
MY_APP_LOG_TO_UNIFIED=true|false

# Level & format
MY_APP_LOG_LEVEL=verbose|debug|info|warn|error
MY_APP_LOG_FORMAT=text|json|yaml

# Debug namespace → enables verbose+debug for that namespace
DEBUG=my-pkg,other-*

# Sanitization (subset shown)
MY_APP_SANITIZE_ENABLED=true|false
MY_APP_SANITIZE_KEYS_DENYLIST=authorization,token,secret,api_key,password

# Trails/tracing
MY_APP_TRACE_OTEL=true|false
MY_APP_TRAILS_DEPTH=true|false
MY_APP_TRAILS_THREAD=true|false
MY_APP_TRAILS_INJECT=true|false
MY_APP_TRAILS_EXTRACT=true|false

# Shadow Logging
MY_APP_SHADOW_ENABLED=true|false
MY_APP_SHADOW_FORMAT=json|yaml
MY_APP_SHADOW_DIR=/var/log/myapp/shadow
MY_APP_SHADOW_TTL_MS=86400000
MY_APP_SHADOW_FORCE_VERBOSE=true|false
MY_APP_SHADOW_RESPECT_ROUTING=true|false
MY_APP_SHADOW_INCLUDE_RAW=false
MY_APP_SHADOW_BUFFER_ENTRIES=0
MY_APP_SHADOW_BUFFER_AGE_MS=0

# Scoping
MY_APP_SCOPING_ENABLED=true|false
MY_APP_SCOPING_ERROR_ENABLED=true|false
MY_APP_SCOPING_ERROR_WINDOW_MS_BEFORE=30000
MY_APP_SCOPING_ERROR_WINDOW_MS_AFTER=30000
MY_APP_SCOPING_BUFFER_ENTRIES=5000
MY_APP_SCOPING_BUFFER_AGE_MS=300000
MY_APP_SCOPING_BUFFER_PREFER_SHADOW=true|false

# Troubleshooting
MY_APP_TROUBLESHOOTING_ENABLED=true|false
MY_APP_TROUBLESHOOTING_NARRATIVES_PATH=./metadata/troubleshooting.json
MY_APP_TROUBLESHOOTING_OUTPUT_FORMATS=markdown,json
MY_APP_TROUBLESHOOTING_OUTPUT_EMIT_AS_LOG_ENTRY=true|false
```

> **Default min level:** `info`.
> **`DEBUG=`**: enables **both** `verbose` and `debug` for matching namespaces.

---

## Core Types

### LogEntry

Internal normalized log shape:

```ts
export interface LogEntry {
  timestamp: string;  // ISO-8601
  level: 'verbose' | 'debug' | 'info' | 'warn' | 'error';
  package: string;
  message: string;
  source?: string;             // e.g. 'application', 'auth-service'
  data?: Record<string, any>;  // user metadata, error, ids, etc.
  
  // Automatic application identification (from consuming project's package.json)
  appName?: string;            // Auto-detected from package.json "name" field
  appVersion?: string;         // Auto-detected from package.json "version" field
  
  // Correlation / trails / tracing
  runId?: string;
  jobId?: string;
  correlationId?: string;
  sessionId?: string;
  operationId?: string;
  parentOperationId?: string;
  operationName?: string;
  threadId?: string;
  traceId?: string;
  spanId?: string;
  
  // Routing
  _routing?: RoutingMeta;
  
  // Optional scope metadata (for future/advanced use)
  scope?: ScopedMetadata;
}
```

### ScopeCriteria

Scoping criteria defines *which logs* belong to a scope. It supports:

* Correlation keys
* Time windows
* Levels
* Sources
* **Text matching on message and data**

```ts
export interface ScopeCriteria {
  // Correlation / keys
  runId?: string;
  correlationId?: string;
  sessionId?: string;
  threadId?: string;
  traceId?: string;
  
  // Time window bounds
  fromTimestamp?: string;      // ISO-8601
  toTimestamp?: string;        // ISO-8601
  
  // Window relative to an anchor (error or first/last entry)
  windowMsBefore?: number;     // relative to anchor timestamp
  windowMsAfter?: number;
  
  // Levels
  levelAtLeast?: 'verbose' | 'debug' | 'info' | 'warn' | 'error';
  includeLevels?: ('verbose'|'debug'|'info'|'warn'|'error')[];
  
  // Source filters
  sources?: string[];          // e.g. ['api-gateway','payments-service']
  
  // TEXT FILTERS
  /**
   * Match logs whose message OR data (stringified) contains ANY of the given strings (case-insensitive).
   * - string: single substring
   * - string[]: log must contain at least one of them
   */
  textIncludesAny?: string | string[];
  
  /**
   * Match logs whose message OR data (stringified) contains ALL of the given substrings (case-insensitive).
   */
  textIncludesAll?: string[];
  
  /**
   * Optional RegExp filter over the combined text (message + JSON-stringified data).
   * If provided as string, it is treated as a new RegExp(text, 'i').
   */
  textMatches?: RegExp | string;
  
  // Scope metadata filters (if used)
  scopeTags?: string[];        // must include all provided tags
  
  // Custom predicate for in-process advanced filtering
  predicate?: (entry: LogEntry) => boolean;
}
```

**Text filtering behavior:**

* Combine `entry.message` and a JSON string of `entry.data` into one string (e.g. `"Payment failed {...}"`).
* Apply:
  * `textIncludesAny` – inclusive OR.
  * `textIncludesAll` – inclusive AND.
  * `textMatches` – regex test.
* All text filtering is **case-insensitive** by default.
* Text filters are **ANDed** with other criteria (correlation, time, etc.).

### ScopedLogView (full data)

```ts
export interface ScopedLogView {
  id: string;                    // e.g. 'scope:runId:checkout-42'
  criteria: ScopeCriteria;
  entries: LogEntry[];           // sorted by timestamp ascending
  summary: {
    firstTimestamp?: string;
    lastTimestamp?: string;
    totalCount: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    verboseCount: number;
    uniqueSources: string[];
  };
}
```

### scopeRecord – Generic Tool

The `scopeRecord` helper is **generic** (not log-specific): given any JSON record, it produces:

* A human-readable text description ("story" of the record).
* A structured description (fields, truncation info).

This function is:
* Used internally to build **scope stories** from `LogEntry`s / aggregated records.
* Exported publicly so other code can reuse it for non-log use cases.

```ts
import { scopeRecord } from 'logs-gateway';

// Example usage
const record = {
  userId: '123',
  action: 'payment',
  amount: 100.50,
  timestamp: '2025-01-01T10:00:00Z'
};

const result = scopeRecord(record, {
  label: 'Payment Event',
  maxFieldStringLength: 200,
  excludeKeys: ['password', 'token']
});

console.log(result.text);
// Output: "Payment Event\n  User ID: 123\n  Action: payment\n  Amount: 100.5\n  Timestamp: 2025-01-01T10:00:00Z"

console.log(result.structured);
// Output: { label: 'Payment Event', fields: [...], ... }
```

**Types:**

```ts
export interface AutoScopeRecordOptions {
  label?: string;
  formatting?: ScopingFormattingOptions;
  maxFields?: number;
  maxFieldStringLength?: number;
  includeKeys?: string[];
  excludeKeys?: string[];
  skipNullish?: boolean;
  header?: string;
  footer?: string;
}

export interface ScopeRecordResult {
  text: string;                    // Human-readable text output
  structured: StructuredScopedPayload;  // Structured representation
}
```

### Scope Story Output

To let a scope answer with full data or story format:

```ts
export type ScopeOutputMode = 'raw' | 'story' | 'both';

export interface ScopeStoryOptions {
  recordOptions?: AutoScopeRecordOptions;
  maxEntries?: number;
  includeEntryHeader?: boolean;
}

export interface ScopeLogsResult {
  view: ScopedLogView;         // always present
  story?: ScopedLogStory;      // present if mode = 'story' or 'both'
}
```

---

## API Reference

### `createLogger(packageConfig, userConfig?) → LogsGateway`

### `LogsGateway` Methods

#### Standard Logging

* `verbose(message, data?)`
* `debug(message, data?)`
* `info(message, data?)`
* `warn(message, data?)`
* `error(message, data?)`
* `isLevelEnabled(level)` – threshold check (namespace DEBUG forces verbose+debug)
* `getConfig()` – effective resolved config

#### Scoping

* `scopeLogs(criteria, options?)` – Scope logs by criteria, return full data and/or story

```ts
const result = await logger.scopeLogs({
  runId: 'checkout-42',
  textIncludesAny: 'timeout',
  levelAtLeast: 'debug'
}, {
  mode: 'both',
  storyOptions: {
    maxEntries: 50,
    includeEntryHeader: true,
    recordOptions: {
      label: 'Log Entry',
      maxFieldStringLength: 200
    }
  }
});

console.log(result.view.summary);
console.log(result.story?.text);
```

#### Troubleshooting

* `troubleshootError(error, context?, options?)` – Error-centric troubleshooting

```ts
const { scope, reports } = await logger.troubleshootError(
  new Error('Missing connections configuration'),
  {
    config: { /* app config */ },
    query: { requestId: req.id },
    operation: 'checkout'
  },
  {
    formats: ['markdown'],
    generateScopeStory: true,
    storyOptions: { /* ... */ }
  }
);
```

* `troubleshootScope(scope, options?)` – Scope-centric troubleshooting

```ts
const { scope: scopeResult, reports } = await logger.troubleshootScope(
  scopeView,  // or ScopeCriteria or scope id string
  {
    formats: ['markdown', 'json'],
    generateScopeStory: true
  }
);
```

* `scopeByNarratives(options?)` – Narrative-based scoping (optional)

### Shadow Controller

* `logger.shadow.enable(runId, opts?)`
* `logger.shadow.disable(runId)`
* `logger.shadow.isEnabled(runId)`
* `logger.shadow.listActive()`
* `logger.shadow.export(runId, outPath?, compress?) → Promise<string>`
* `logger.shadow.readIndex(runId) → Promise<ShadowIndex>`
* `logger.shadow.cleanupExpired(now?) → Promise<number>`

*(Shadow writes sidecar files; primary transports unaffected.)*

---

## Usage Examples

### 1) Error → Scoped logs (text filter) → Story + Troubleshooting

```ts
import { createLogger, scopeRecord } from 'logs-gateway';

const logger = createLogger(
  { packageName: 'PAYMENTS', envPrefix: 'PAY' },
  {
    logToConsole: true,
    logFormat: 'json',
    shadow: {
      enabled: true,
      format: 'json',
      directory: './logs/shadow',
      ttlMs: 86400000,
      forceVerbose: true
    },
    scoping: {
      enabled: true,
      errorScoping: {
        enabled: true,
        windowMsBefore: 60_000,
        windowMsAfter: 30_000
      },
      buffer: {
        maxEntries: 5000,
        maxAgeMs: 300_000,
        includeLevels: ['verbose','debug','info','warn','error'],
        preferShadow: true
      }
    },
    troubleshooting: {
      enabled: true,
      narrativesPath: './metadata/troubleshooting.json',
      output: {
        formats: ['markdown'],
        emitAsLogEntry: true,
        writeToFileDir: './logs/troubleshooting'
      }
    }
  }
);

async function handleCheckout(req: any) {
  const runId = `checkout-${Date.now()}`;
  logger.info('Checkout started', { runId });
  logger.verbose('Preparing payment context', { runId });
  
  try {
    // ...
    throw new Error('Missing connections configuration');
  } catch (error) {
    // Direct troubleshooting call
    const { scope, reports } = await logger.troubleshootError(error, {
      config: { /* app config */ },
      query: { requestId: req.id },
      operation: 'checkout'
    }, {
      formats: ['markdown'],
      generateScopeStory: true,
      storyOptions: {
        maxEntries: 50,
        includeEntryHeader: true,
        recordOptions: {
          label: 'Log Entry',
          maxFieldStringLength: 200,
          excludeKeys: ['password', 'token']
        }
      }
    });
    
    // Scope includes full data + story
    console.log(scope?.view.summary);
    console.log(scope?.story?.text);
    
    // Reports contain troubleshooting text
    return {
      ok: false,
      troubleshooting: reports.map(r => r.rendered)
    };
  }
}
```

### 2) Manual scoping by text ("include any log that mentions X")

```ts
// Scope all logs in the last 5 minutes that mention "timeout" anywhere:
const timeoutScope = await logger.scopeLogs({
  levelAtLeast: 'debug',
  fromTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  textIncludesAny: 'timeout'  // message or data, case-insensitive
}, {
  mode: 'both',
  storyOptions: {
    includeEntryHeader: true,
    recordOptions: { label: 'Timeout Log' }
  }
});

console.log(timeoutScope.view.summary);
console.log(timeoutScope.story?.text);
```

### 3) Web Application

```ts
// src/logger.ts
import { createLogger, LoggingConfig, LogsGateway } from 'logs-gateway';

export function createAppLogger(config?: LoggingConfig): LogsGateway {
  return createLogger(
    { packageName: 'WEB_APP', envPrefix: 'WEB_APP', debugNamespace: 'web-app' },
    config
  );
}

// src/index.ts
const logger = createAppLogger({ logFormat: 'json' });
logger.info('Web application initialized', { version: '1.0.0' });

async function handleRequest(request: any) {
  logger.debug('Handling request', { requestId: request.id });
  // ...
  logger.info('Request processed', { responseTime: 42, runId: request.runId });
}
```

### 4) Shadow Logging (per-run capture)

Capture everything for a **specific `runId`** to a side file (forced-verbose), then fetch it — perfect for tests.

```ts
const logger = createLogger(
  { packageName: 'API', envPrefix: 'API' },
  { shadow: { enabled: true, format: 'yaml', ttlMs: 86_400_000 } }
);

const runId = `test-${Date.now()}`;

// Turn on capture for this run (can be mid-execution)
logger.shadow.enable(runId);

logger.info('test start', { runId });
logger.verbose('deep details', { runId, step: 1 });
logger.debug('more details', { runId, step: 2 });

// ... run test ...

// Export & stop capturing
await logger.shadow.export(runId, './artifacts');  // returns exported path
logger.shadow.disable(runId);
```

> Shadow files are stored per-run (JSONL or YAML multi-doc), rotated by size/age, and removed by TTL (default **1 day**).
> If `forceVerbose=true`, all levels for that `runId` are captured even when global level is higher.

---

## Correlation & Trails

Attach correlation fields freely on each call:

* **Job/Correlation:** `runId`, `jobId`, `correlationId`, `sessionId`
* **Depth / Operation trail:** `operationId`, `parentOperationId`, `operationName`, `operationPath`, `operationStep`
* **Thread / Causal trail:** `threadId`, `eventId`, `causationId`, `sequenceNo`, `partitionKey`, `attempt`, `shardId`, `workerId`
* **Tracing:** `traceId`, `spanId` (if OpenTelemetry context is active)

Every log entry automatically merges the current trail context. The library provides optional adapters for HTTP and queue systems to **inject/extract** headers across process boundaries.

---

## Routing Metadata & Recursion Safety

```ts
interface RoutingMeta {
  allowedOutputs?: string[];  // e.g. ['unified-logger','console']
  blockOutputs?: string[];    // e.g. ['unified-logger','file','shadow','troubleshooting']
  reason?: string;
  tags?: string[];
}
```

* Gateway internal logs (`source: 'logs-gateway-internal'`) never reach unified-logger.
* `_routing` lets you allow/block specific outputs per entry.
* Shadow Logging honors `_routing.blockOutputs` by default (configurable).
* Troubleshooting output can be blocked via `_routing.blockOutputs: ['troubleshooting']`.

---

## Log Formats

**Text**

```
[2025-01-15T10:30:45.123Z] [MY_APP] [INFO] Application initialized {"version":"1.0.0"}
```

**JSON**

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "package": "MY_APP",
  "level": "INFO",
  "message": "Application initialized",
  "source": "application",
  "data": {"version": "1.0.0"}
}
```

**YAML** (console/file; unified stays JSON)

```yaml
---
timestamp: 2025-01-15T10:30:45.123Z
package: MY_APP
level: INFO
message: Application initialized
source: application
appName: my-awesome-app
appVersion: "2.1.0"
data:
  version: "1.0.0"
```

> **Note:** YAML is human-friendly but slower; prefer JSON for ingestion.

---

## PII/Credentials Sanitization (opt-in)

Enable to auto-detect and mask common sensitive data (JWTs, API keys, passwords, emails, credit cards, cloud keys, etc.).
Supports key-based rules (denylist/allowlist), hashing specific fields, depth/size/time guardrails, and a truncation flag.

```ts
const logger = createLogger(
  { packageName: 'MY_APP', envPrefix: 'MY_APP' },
  {
    sanitization: {
      enabled: true,
      maskWith: '[REDACTED]',
      keysDenylist: ['authorization','password','secret','api_key'],
      fieldsHashInsteadOfMask: ['userId'],
      detectJWTs: true
    }
  }
);
```

---

## Shadow Logging (Per-Run Debug Capture)

Shadow Logging allows you to capture **all logs for a specific `runId`** to a separate file in JSON or YAML format, with **raw (unsanitized) data**, regardless of the global log level. This is ideal for debugging tests, CI runs, or specific production workflows.

### Key Features

- **Per-runId capture**: Enable capture for specific run identifiers
- **Verbose by default**: Captures all log levels for the target runId
- **Raw data**: Bypasses sanitization to preserve original values (⚠️ use with caution)
- **Optional rolling buffer**: Capture logs from before shadow was enabled ("after-the-fact")
- **TTL cleanup**: Automatically manage storage with time-to-live expiration
- **No interference**: Shadow writes are async and won't affect primary logging

### Configuration

#### Constructor Options

```typescript
interface ShadowConfig {
  enabled?: boolean;                 // default: false
  format?: 'json' | 'yaml';          // default: 'json'
  directory?: string;                // default: './logs/shadow'
  ttlMs?: number;                    // default: 86400000 (1 day)
  respectRoutingBlocks?: boolean;    // default: true
  rollingBuffer?: {
    maxEntries?: number;             // default: 0 (disabled)
    maxAgeMs?: number;               // default: 0 (disabled)
  };
}
```

### Runtime API

#### `logger.shadow.enable(runId, opts?)`

Enable shadow capture for a specific runId. Optionally override config for this run.

```typescript
logger.shadow.enable('test-run-123');

// Or with custom options
logger.shadow.enable('test-run-yaml', {
  format: 'yaml',
  ttlMs: 3600000  // 1 hour
});
```

#### `logger.shadow.disable(runId)`

Stop capturing logs for a runId and finalize the shadow file.

#### `logger.shadow.isEnabled(runId)`

Check if shadow capture is active for a runId.

#### `logger.shadow.listActive()`

List all currently active shadow captures.

#### `logger.shadow.export(runId, outPath?)`

Copy the shadow file to a destination path.

#### `logger.shadow.cleanupExpired(now?)`

Delete expired shadow files based on TTL. Returns number of deleted runs.

### Important Considerations

⚠️ **Security**: Shadow captures **raw, unsanitized data**. This means passwords, API keys, and PII will be preserved in shadow files. Only use shadow logging in secure environments (development, CI, isolated test systems).

💾 **Storage**: Shadow files can grow quickly when capturing verbose logs. Configure appropriate `ttlMs` values and regularly run `cleanupExpired()`.

🚫 **Default OFF**: Shadow logging is disabled by default and must be explicitly enabled via config or environment variables.

---

## Troubleshooting Integration

The troubleshooting integration uses `nx-troubleshooting` to match errors to solutions. See the [nx-troubleshooting documentation](https://www.npmjs.com/package/nx-troubleshooting) for details on creating troubleshooting narratives.

### Key Features

- **Intelligent Error Matching** – Matches errors to solutions using multiple strategies
- **Flexible Probe System** – Built-in probes plus extensible custom probes
- **Template Variables** – Dynamic solution messages with `{{variable}}` syntax
- **Multiple Output Formats** – Markdown, JSON, and plain text formatting
- **Automatic Scoping** – Errors automatically trigger scoped log collection

### Example Troubleshooting Narrative

```json
{
  "id": "missing-connections-config",
  "title": "Missing Connections Configuration",
  "description": "The application config is missing the required 'connections' object...",
  "symptoms": [
    {
      "probe": "config-check",
      "params": { "field": "connections" },
      "condition": "result.exists == false"
    }
  ],
  "solution": [
    {
      "type": "code",
      "message": "Add a 'connections' object to your config:",
      "code": "{\n  \"connections\": { ... }\n}"
    }
  ]
}
```

---

## Backwards Compatibility

* All new behavior is **opt-in**:
  * `scoping.enabled` and `troubleshooting.enabled` default to `false`.
* If `nx-troubleshooting` is not installed:
  * `troubleshooting.enabled` must remain `false` or initialization fails clearly.
* If neither shadow nor buffer is configured:
  * `scopeLogs` can still filter **currently available** logs if in-memory buffer is enabled; otherwise, scopes may be empty.
* `scopeRecord` is pure and can be used independently anywhere.

---

## Environment Variables (summary)

| Key                    | Description                            | Default   |
| ---------------------- | -------------------------------------- | --------- |
| `{P}_LOG_TO_CONSOLE`   | Enable console output                  | `true`    |
| `{P}_LOG_TO_FILE`      | Enable file output                     | `false`   |
| `{P}_LOG_FILE`         | Log file path                          | —         |
| `{P}_LOG_TO_UNIFIED`   | Enable unified-logger                  | `false`   |
| `{P}_LOG_LEVEL`        | `verbose\|debug\|info\|warn\|error` | `info` |
| `{P}_LOG_FORMAT`       | `text\|json\|yaml` | `text` |
| `DEBUG`                | Namespace(s) enabling verbose+debug    | —         |
| `{P}_SANITIZE_ENABLED` | Turn on sanitization                   | `false`   |
| `{P}_TRACE_OTEL`       | Attach `traceId`/`spanId` if available | `true`    |
| `{P}_TRAILS_*`         | Toggle trails/header adapters          | see above |
| `{P}_SHADOW_*`         | Shadow Logging controls                | see above |
| `{P}_SCOPING_*`        | Scoping controls                       | see above |
| `{P}_TROUBLESHOOTING_*` | Troubleshooting controls              | see above |

---

## Development

```bash
npm install
npm run build
npm run dev
npm run clean
```

## License

MIT

---

**Tip for tests:** set a `runId` at the beginning of each test (e.g., `runId: 'ci-<suite>-<timestamp>'`), enable **Shadow Logging**, run, then `export()` the captured logs for artifacts/triage.
