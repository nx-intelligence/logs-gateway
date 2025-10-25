Here’s a rewritten README that folds in **YAML output**, **five levels (incl. `verbose`)**, **dual trails (Depth & Thread)**, **OTel context**, and the new **Shadow Logging (per-run capture)** — while keeping all existing behaviors.

---

# logs-gateway

A standardized logging gateway for Node.js applications. Flexible multi-transport logging with **console**, **file**, and **unified-logger** outputs; **ENV-first** configuration; **PII/credentials sanitization**; **dual correlation trails** (operation & thread); **OpenTelemetry** context; **YAML/JSON/text** formats; and **per-run “Shadow Logging”** for test/debug capture.

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

---

## Installation

```bash
npm install logs-gateway
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
    shadow: { enabled: false, ttlMs: 86_400_000 } // 1 day
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
```

> **Default min level:** `info`.
> **`DEBUG=`**: enables **both** `verbose` and `debug` for matching namespaces.

---

## Usage Examples

### 1) Web Application

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

### 2) Database Service

```ts
const dbLogger = createLogger(
  { packageName: 'DATABASE_SERVICE', envPrefix: 'DB_SERVICE', debugNamespace: 'db' }
);

dbLogger.info('Database service initialized');
dbLogger.debug('Executing query', { sql: 'select 1' });
```

### 3) Unified-Logger with Papertrail

```ts
const logger = createLogger(
  { packageName: 'WEB_APP', envPrefix: 'WEB_APP' },
  {
    enableUnifiedLogger: true,
    unifiedLogger: {
      transports: { papertrail: true, console: false },
      service: 'web-app',
      env: 'production',
      level: 'info'
    }
  }
);

// Correlation + routing
logger.info('User login', {
  source: 'auth-service',
  correlationId: 'req-123',
  runId: 'test-001'
});

logger.info('Sensitive DB op', {
  source: 'database',
  _routing: { blockOutputs: ['unified-logger'], reason: 'sensitive-data' }
});
```

### 4) YAML Format (dev-friendly)

```ts
const logger = createLogger(
  { packageName: 'PAYMENTS', envPrefix: 'PAY' },
  { logFormat: 'yaml', logToConsole: true, logToFile: true, logFilePath: '/var/log/payments-dev.log' }
);

logger.info('Reserved all', { count: 3, tags: ['checkout'] });
// Console/file: multi-doc YAML with `---` separators
// Unified-logger (if enabled): still JSON
```

### 5) **Shadow Logging** (per-run capture)

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
  blockOutputs?: string[];    // e.g. ['unified-logger','file','shadow']
  reason?: string;
  tags?: string[];
}
```

* Gateway internal logs (`source: 'logs-gateway-internal'`) never reach unified-logger.
* `_routing` lets you allow/block specific outputs per entry.
* Shadow Logging honors `_routing.blockOutputs` by default (configurable).

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

## API Reference

### `createLogger(packageConfig, userConfig?) → LogsGateway`

### `LogsGateway` Methods

* `verbose(message, data?)`
* `debug(message, data?)`
* `info(message, data?)`
* `warn(message, data?)`
* `error(message, data?)`
* `isLevelEnabled(level)` – threshold check (namespace DEBUG forces verbose+debug)
* `getConfig()` – effective resolved config

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

## Shadow Logging (Per-Run Debug Capture)

Shadow Logging allows you to capture **all logs for a specific `runId`** to a separate file in JSON or YAML format, with **raw (unsanitized) data**, regardless of the global log level. This is ideal for debugging tests, CI runs, or specific production workflows.

### Key Features

- **Per-runId capture**: Enable capture for specific run identifiers
- **Verbose by default**: Captures all log levels for the target runId
- **Raw data**: Bypasses sanitization to preserve original values (⚠️ use with caution)
- **Optional rolling buffer**: Capture logs from before shadow was enabled ("after-the-fact")
- **TTL cleanup**: Automatically manage storage with time-to-live expiration
- **No interference**: Shadow writes are async and won't affect primary logging

### Quick Start

```typescript
import { createLogger } from 'logs-gateway';

const logger = createLogger(
  { packageName: 'TEST_RUNNER', envPrefix: 'TEST' },
  {
    shadow: {
      enabled: true,
      format: 'json',
      directory: './logs/shadow',
      ttlMs: 86400000, // 1 day
      rollingBuffer: {
        maxEntries: 2000,  // Keep last 2000 entries
        maxAgeMs: 60000    // Drop entries older than 1 minute
      }
    }
  }
);

// Enable shadow capture for a test run
const runId = `test-${Date.now()}`;
logger.shadow.enable(runId);

// All logs with this runId will be captured to shadow
logger.verbose('Detailed debug info', { runId, step: 1 });
logger.debug('More debug', { runId, step: 2 });
logger.info('Test started', { runId });
logger.warn('Warning occurred', { runId });
logger.error('Error details', { runId, error: new Error('fail') });

// Export the captured logs
await logger.shadow.export(runId, './test-artifacts/test-log.jsonl');

// Disable capture when done
logger.shadow.disable(runId);
```

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

#### Environment Variables

```bash
# Enable shadow logging
TEST_SHADOW_ENABLED=true

# Output format (json or yaml)
TEST_SHADOW_FORMAT=json

# Shadow files directory
TEST_SHADOW_DIR=./logs/shadow

# Time-to-live in milliseconds
TEST_SHADOW_TTL_MS=86400000

# Respect routing blocks (file/shadow)
TEST_SHADOW_RESPECT_ROUTING=true

# Rolling buffer settings
TEST_SHADOW_BUFFER_ENTRIES=2000
TEST_SHADOW_BUFFER_AGE_MS=60000
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

```typescript
logger.shadow.disable('test-run-123');
```

#### `logger.shadow.isEnabled(runId)`

Check if shadow capture is active for a runId.

```typescript
if (logger.shadow.isEnabled('test-run-123')) {
  console.log('Shadow capture is active');
}
```

#### `logger.shadow.listActive()`

List all currently active shadow captures.

```typescript
const active = logger.shadow.listActive();
// Returns: [{ runId: 'test-run-123', since: '2025-10-25T10:30:00Z', format: 'json' }]
```

#### `logger.shadow.export(runId, outPath?)`

Copy the shadow file to a destination path.

```typescript
// Export to current directory with default name
const path = await logger.shadow.export('test-run-123');

// Export to specific path
await logger.shadow.export('test-run-123', './artifacts/test-log.jsonl');
```

#### `logger.shadow.cleanupExpired(now?)`

Delete expired shadow files based on TTL. Returns number of deleted runs.

```typescript
// Clean up expired runs
const deletedCount = await logger.shadow.cleanupExpired();
console.log(`Deleted ${deletedCount} expired shadow runs`);

// Or simulate cleanup at a specific time
const futureTime = Date.now() + 86400000;
await logger.shadow.cleanupExpired(futureTime);
```

### Storage Structure

Shadow files are organized per-runId in the configured directory:

```
./logs/shadow/
  test-run-123/
    index.json              # Manifest with metadata
    test-run-123.jsonl      # All logs for this run (or .yaml)
  test-run-456/
    index.json
    test-run-456.jsonl
```

**index.json** contains:

```json
{
  "runId": "test-run-123",
  "createdAt": "2025-10-25T10:30:00.000Z",
  "updatedAt": "2025-10-25T10:35:31.000Z",
  "ttlMs": 86400000,
  "format": "json",
  "entryCount": 1234,
  "filePath": "test-run-123.jsonl",
  "meta": {
    "host": "ci-runner-03",
    "pid": 1423,
    "package": "TEST_RUNNER"
  }
}
```

### Usage Patterns

#### 1. CI/Test Runner Integration

```typescript
// test-setup.ts
import { createLogger } from 'logs-gateway';

export const logger = createLogger(
  { packageName: 'CI_TESTS', envPrefix: 'CI' },
  {
    shadow: {
      enabled: process.env.CI === 'true',
      directory: './test-artifacts/shadow',
      format: 'json'
    }
  }
);

// test-suite.test.ts
import { logger } from './test-setup';

describe('Payment Flow', () => {
  const runId = `payment-test-${Date.now()}`;
  
  beforeAll(() => {
    logger.shadow.enable(runId);
  });
  
  afterAll(async () => {
    await logger.shadow.export(runId, `./artifacts/${runId}.jsonl`);
    logger.shadow.disable(runId);
  });
  
  it('should process payment', () => {
    logger.info('Starting payment', { runId, amount: 100 });
    // ... test logic ...
  });
});
```

#### 2. After-the-Fact Debugging

```typescript
// Start with rolling buffer enabled
const logger = createLogger(
  { packageName: 'API', envPrefix: 'API' },
  {
    shadow: {
      enabled: true,
      rollingBuffer: {
        maxEntries: 2000,
        maxAgeMs: 60000  // Last 1 minute
      }
    }
  }
);

// Application runs normally...
logger.info('Request received', { runId: 'req-123' });
logger.debug('Processing', { runId: 'req-123' });

// Error occurs - enable shadow capture retroactively
logger.error('Payment failed!', { runId: 'req-123' });
logger.shadow.enable('req-123');  // Flushes last 2000 buffered logs for req-123
```

#### 3. Per-Entry Shadow Override

```typescript
// Force a specific log to a shadow file without enabling for the whole run
logger.info('Sensitive operation', {
  runId: 'prod-request-456',
  _shadow: { runId: 'debug-capture' }  // Capture to debug-capture shadow
});
```

### Important Considerations

⚠️ **Security**: Shadow captures **raw, unsanitized data**. This means passwords, API keys, and PII will be preserved in shadow files. Only use shadow logging in secure environments (development, CI, isolated test systems).

💾 **Storage**: Shadow files can grow quickly when capturing verbose logs. Configure appropriate `ttlMs` values and regularly run `cleanupExpired()`.

🚫 **Default OFF**: Shadow logging is disabled by default and must be explicitly enabled via config or environment variables.

✅ **Recommended Use Cases**:
- Debugging CI/test failures with full context
- Capturing verbose logs for specific problematic requests in staging
- Temporary deep-dive debugging in development

❌ **Not Recommended**:
- Production systems with sensitive data (unless isolated)
- Long-running services without TTL cleanup
- High-throughput systems (performance impact)

### Routing and Blocking

Shadow respects `_routing.blockOutputs` metadata by default:

```typescript
// This log won't be captured to shadow
logger.info('Internal log', {
  runId: 'test-123',
  _routing: {
    blockOutputs: ['shadow', 'file']
  }
});

// Override routing blocks for specific captures
const logger = createLogger(pkg, {
  shadow: {
    enabled: true,
    respectRoutingBlocks: false  // Capture everything
  }
});
```

---

## Environment Variables (summary)

| Key                    | Description                            | Default   |       |        |        |        |
| ---------------------- | -------------------------------------- | --------- | ----- | ------ | ------ | ------ |
| `{P}_LOG_TO_CONSOLE`   | Enable console output                  | `true`    |       |        |        |        |
| `{P}_LOG_TO_FILE`      | Enable file output                     | `false`   |       |        |        |        |
| `{P}_LOG_FILE`         | Log file path                          | —         |       |        |        |        |
| `{P}_LOG_TO_UNIFIED`   | Enable unified-logger                  | `false`   |       |        |        |        |
| `{P}_LOG_LEVEL`        | `verbose                               | debug     | info  | warn   | error` | `info` |
| `{P}_LOG_FORMAT`       | `text                                  | json      | yaml` | `text` |        |        |
| `DEBUG`                | Namespace(s) enabling verbose+debug    | —         |       |        |        |        |
| `{P}_SANITIZE_ENABLED` | Turn on sanitization                   | `false`   |       |        |        |        |
| `{P}_TRACE_OTEL`       | Attach `traceId`/`spanId` if available | `true`    |       |        |        |        |
| `{P}_TRAILS_*`         | Toggle trails/header adapters          | see above |       |        |        |        |
| `{P}_SHADOW_*`         | Shadow Logging controls                | see above |       |        |        |        |

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
