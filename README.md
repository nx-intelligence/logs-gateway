# logs-gateway

A standardized logging gateway for Node.js applications. Provides flexible logging with console output, file output, unified-logger integration, environment variable configuration, and custom logger injection.

## Features

- ✅ **Console output** (default)
- ✅ **File output** (optional)
- ✅ **Unified-logger output** (Papertrail/UDP/Console via @x-developer/unified-logger)
- ✅ **Dual/triple output** (console + file + unified-logger)
- ✅ **Environment variable configuration**
- ✅ **Custom logger injection** (Winston, Pino, etc.)
- ✅ **Package-specific prefixes**
- ✅ **Multiple log levels** (debug, info, warn, error)
- ✅ **Multiple formats** (text, json)
- ✅ **Routing metadata** (control output destinations)
- ✅ **Recursion safety** (prevent circular logging)
- ✅ **TypeScript support**

## Installation

```bash
npm install logs-gateway
```

## Quick Start

```typescript
import { createLogger } from 'logs-gateway';

// Create a package-specific logger
const logger = createLogger(
  { packageName: 'MY_APP', envPrefix: 'MY_APP' },
  { 
    logToFile: true, 
    logFilePath: '/var/log/myapp.log',
    enableUnifiedLogger: true,
    unifiedLogger: {
      transports: { papertrail: true },
      service: 'my-app',
      env: 'production'
    }
  }
);

// Use it
logger.info('Application initialized');
logger.debug('Debug info', { data: 'some data' });
logger.error('Error occurred', { error: new Error('Something went wrong') });
```

## Configuration

### Via Constructor

```typescript
const logger = createLogger(
  { packageName: 'MY_PACKAGE', envPrefix: 'MY_PACKAGE' },
  {
    logToConsole: true,              // default: true
    logToFile: true,                 // default: false
    logFilePath: '/var/log/app.log', // required if logToFile
    logLevel: 'debug',               // debug|info|warn|error
    logFormat: 'json',               // text|json
    enableUnifiedLogger: true,       // default: false
    unifiedLogger: {                 // unified-logger config
      transports: { papertrail: true },
      service: 'my-service',
      env: 'production'
    },
    defaultSource: 'my-app'          // default: 'application'
  }
);
```

### Via Environment Variables

```bash
# Console logging
MY_APP_LOG_TO_CONSOLE=true|false

# File logging
MY_APP_LOG_TO_FILE=true|false
MY_APP_LOG_FILE=/path/to/log

# Unified-logger output
MY_APP_LOG_TO_UNIFIED=true|false

# Log level
MY_APP_LOG_LEVEL=debug|info|warn|error

# Log format
MY_APP_LOG_FORMAT=text|json

# Debug mode (enables debug level)
DEBUG=my-app-namespace

# Unified-logger environment variables
PAPERTRAIL_HOST=logs.papertrailapp.com
PAPERTRAIL_PORT=12345
UDP_RELAY_HOST=127.0.0.1
UDP_RELAY_PORT=514
```

## Usage Examples

### Example 1: Web Application

```typescript
// src/logger.ts
import { createLogger, LoggingConfig, LogsGateway } from 'logs-gateway';

export function createAppLogger(config?: LoggingConfig): LogsGateway {
  return createLogger(
    {
      packageName: 'WEB_APP',
      envPrefix: 'WEB_APP',
      debugNamespace: 'web-app'
    },
    config
  );
}

// src/index.ts
import { createAppLogger } from './logger';

export class WebApp {
  private logger: LogsGateway;

  constructor(config: AppConfig & { logging?: LoggingConfig }) {
    this.logger = createAppLogger(config.logging);
    this.logger.info('Web application initialized', { version: '1.0.0' });
  }

  async handleRequest(request: Request): Promise<Response> {
    this.logger.debug('Handling request', { requestId: request.id });
    // ... processing
    this.logger.info('Request processed', { responseTime: Date.now() - request.startTime });
    return response;
  }
}
```

### Example 2: Database Service

```typescript
// src/logger.ts
import { createLogger, LoggingConfig, LogsGateway } from 'logs-gateway';

export function createDbLogger(config?: LoggingConfig): LogsGateway {
  return createLogger(
    {
      packageName: 'DATABASE_SERVICE',
      envPrefix: 'DB_SERVICE',
      debugNamespace: 'db-service'
    },
    config
  );
}

// src/index.ts
import { createDbLogger } from './logger';

export class DatabaseService {
  private logger: LogsGateway;

  constructor(config: DbConfig & { logging?: LoggingConfig }) {
    this.logger = createDbLogger(config.logging);
    this.logger.info('Database service initialized');
  }

  async query(sql: string): Promise<any> {
    this.logger.debug('Executing query', { sql });
    // ... execute query
  }
}
```

### Example 3: Unified-Logger with Papertrail

```typescript
import { createLogger } from 'logs-gateway';

const logger = createLogger(
  { packageName: 'WEB_APP', envPrefix: 'WEB_APP' },
  {
    enableUnifiedLogger: true,
    unifiedLogger: {
      transports: { 
        papertrail: true,
        console: false 
      },
      service: 'web-app',
      env: 'production',
      level: 'info'
    }
  }
);

// Basic logging with source and correlation
logger.info('User login', { 
  source: 'auth-service', 
  correlationId: 'req-123',
  userId: 'user-456' 
});

// Prevent recursion with routing metadata
logger.info('Database operation completed', { 
  source: 'database-service',
  _routing: { 
    blockOutputs: ['unified-logger'],
    reason: 'prevent-recursion' 
  }
});
```

### Example 4: Custom Logger Integration (Winston)

```typescript
import winston from 'winston';
import { createLogger, LoggingConfig } from 'logs-gateway';

const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const customLogger = {
  debug: (msg: string, data?: any) => winstonLogger.debug(msg, data),
  info: (msg: string, data?: any) => winstonLogger.info(msg, data),
  warn: (msg: string, data?: any) => winstonLogger.warn(msg, data),
  error: (msg: string, data?: any) => winstonLogger.error(msg, data)
};

const logger = createLogger(
  { packageName: 'MY_APP', envPrefix: 'MY_APP' },
  { customLogger }  // Use Winston instead of built-in logger
);
```

### Example 5: Multiple Services Using the Same Gateway

Each service just needs:

1. **Add dependency**: `"logs-gateway": "^1.1.0"`
2. **Create factory**:

```typescript
// Service 1: Web API
export const logger = createLogger({ packageName: 'WEB_API', envPrefix: 'WEB_API' });

// Service 2: Database
export const logger = createLogger({ packageName: 'DATABASE', envPrefix: 'DATABASE' });

// Service 3: Cache
export const logger = createLogger({ packageName: 'CACHE_SERVICE', envPrefix: 'CACHE' });

// Service 4: Queue
export const logger = createLogger({ packageName: 'QUEUE_SERVICE', envPrefix: 'QUEUE' });

// Service 5: Auth
export const logger = createLogger({ packageName: 'AUTH_SERVICE', envPrefix: 'AUTH' });

// Service 6: Monitoring
export const logger = createLogger({ packageName: 'MONITORING', envPrefix: 'MONITOR' });

// Service 7: File Storage
export const logger = createLogger({ packageName: 'FILE_STORAGE', envPrefix: 'STORAGE' });

// Service 8: Email Service
export const logger = createLogger({ packageName: 'EMAIL_SERVICE', envPrefix: 'EMAIL' });

// Service 9: Analytics
export const logger = createLogger({ packageName: 'ANALYTICS', envPrefix: 'ANALYTICS' });

// Service 10: Notifications
export const logger = createLogger({ packageName: 'NOTIFICATIONS', envPrefix: 'NOTIFY' });
```

**Update logs-gateway once, all services benefit!**

## Routing Metadata & Recursion Safety

logs-gateway includes built-in routing metadata to control where logs are sent and prevent recursion:

### Routing Metadata

```typescript
interface RoutingMeta {
  allowedOutputs?: string[];  // e.g., ['unified-logger', 'console']
  blockOutputs?: string[];    // e.g., ['unified-logger', 'file']
  reason?: string;            // debugging aid
  tags?: string[];            // optional hints
}
```

### Usage Examples

```typescript
// Block specific outputs
logger.info('Sensitive operation', {
  source: 'auth-service',
  _routing: {
    blockOutputs: ['unified-logger'],
    reason: 'sensitive-data'
  }
});

// Allow only specific outputs
logger.debug('Debug info', {
  source: 'debug-service',
  _routing: {
    allowedOutputs: ['console'],
    reason: 'debug-only'
  }
});

// Prevent recursion
logger.info('Database operation', {
  source: 'database-service',
  _routing: {
    blockOutputs: ['unified-logger'],
    reason: 'prevent-recursion'
  }
});
```

### Safety Features

- **Gateway internal logs** (`source: 'logs-gateway-internal'`) never reach unified-logger
- **Routing metadata** controls output destinations per log entry
- **Recursion prevention** built into the routing system
- **Graceful degradation** if unified-logger fails to initialize

## API Reference

### `createLogger(packageConfig, userConfig?)`

Creates a new logger instance.

**Parameters:**
- `packageConfig: LoggerPackageConfig` - Package identification
- `userConfig?: LoggingConfig` - Optional logging configuration

**Returns:** `LogsGateway` instance

### `LogsGateway` Class

#### Methods

- `debug(message: string, data?: any): void` - Log debug message
- `info(message: string, data?: any): void` - Log info message  
- `warn(message: string, data?: any): void` - Log warning message
- `error(message: string, data?: any): void` - Log error message
- `getConfig(): Readonly<InternalLoggingConfig>` - Get current configuration
- `isLevelEnabled(level: LogLevel): boolean` - Check if level is enabled

#### Log Levels

- `debug` - Detailed information (lowest priority)
- `info` - General information
- `warn` - Warning messages
- `error` - Error messages (highest priority)

#### Log Formats

**Text Format:**
```
[2024-01-15T10:30:45.123Z] [MY_APP] [INFO] Application initialized {"version":"1.0.0"}
```

**JSON Format:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "package": "MY_APP",
  "level": "INFO",
  "message": "Application initialized",
  "data": {"version": "1.0.0"}
}
```

## Environment Variables

All environment variables follow the pattern: `{ENV_PREFIX}_{SETTING}`

| Variable | Description | Default |
|----------|-------------|---------|
| `{PREFIX}_LOG_TO_CONSOLE` | Enable console output | `true` |
| `{PREFIX}_LOG_TO_FILE` | Enable file output | `false` |
| `{PREFIX}_LOG_FILE` | Log file path | Required if file logging |
| `{PREFIX}_LOG_LEVEL` | Minimum log level | `info` |
| `{PREFIX}_LOG_FORMAT` | Output format | `text` |
| `DEBUG` | Debug namespace | Enables debug level |

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode
npm run dev

# Clean build artifacts
npm run clean
```

## License

MIT
