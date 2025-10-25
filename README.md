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
