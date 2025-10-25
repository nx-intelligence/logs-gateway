/**
 * Type tests for logs-gateway interfaces
 * These tests validate that our TypeScript interfaces are correctly defined
 */

import { describe, it, expect } from 'vitest';
import type {
  TrailsConfig,
  TransportsConfig,
  TracingConfig,
  LogEnvelope,
  OperationCtx,
  ThreadContext,
  LoggingConfig
} from './types';

describe('Type Definitions', () => {
  describe('TrailsConfig', () => {
    it('should accept all optional properties', () => {
      const config: TrailsConfig = {
        enableDepthTrail: true,
        enableThreadTrail: true,
        injectHeaders: true,
        extractHeaders: true,
        sequenceWindow: 1000
      };
      expect(config).toBeDefined();
    });

    it('should allow partial configuration', () => {
      const config: TrailsConfig = {
        enableDepthTrail: false
      };
      expect(config.enableDepthTrail).toBe(false);
    });
  });

  describe('TransportsConfig', () => {
    it('should accept core transport options', () => {
      const config: TransportsConfig = {
        core: 'pino',
        fileRotation: 'winston',
        devPretty: true
      };
      expect(config.core).toBe('pino');
    });

    it('should accept builtin core option', () => {
      const config: TransportsConfig = {
        core: 'builtin'
      };
      expect(config.core).toBe('builtin');
    });
  });

  describe('TracingConfig', () => {
    it('should accept OTel context option', () => {
      const config: TracingConfig = {
        enableOtelContext: true
      };
      expect(config.enableOtelContext).toBe(true);
    });
  });

  describe('LogEnvelope', () => {
    it('should require core fields', () => {
      const envelope: LogEnvelope = {
        timestamp: '2024-01-01T00:00:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test message',
        source: 'test'
      };
      expect(envelope.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should accept all optional trail fields', () => {
      const envelope: LogEnvelope = {
        timestamp: '2024-01-01T00:00:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test message',
        source: 'test',
        correlationId: 'corr-123',
        jobId: 'job-456',
        runId: 'run-789',
        sessionId: 'session-abc',
        operationId: 'op-123',
        parentOperationId: 'op-456',
        operationName: 'test-operation',
        operationPath: 'test.operation',
        operationStep: 1,
        threadId: 'thread-123',
        eventId: 'event-456',
        causationId: ['cause-1', 'cause-2'],
        sequenceNo: 42,
        partitionKey: 'partition-1',
        attempt: 1,
        shardId: 'shard-1',
        workerId: 'worker-1',
        traceId: 'trace-123',
        spanId: 'span-456',
        tags: ['test', 'example']
      };
      expect(envelope.operationId).toBe('op-123');
      expect(envelope.threadId).toBe('thread-123');
    });
  });

  describe('OperationCtx', () => {
    it('should define operation context structure', () => {
      const ctx: OperationCtx = {
        operationId: 'op-123',
        parentOperationId: 'op-456',
        operationName: 'test-operation',
        operationPath: 'test.operation',
        operationStep: 1,
        traceId: 'trace-123',
        spanId: 'span-456'
      };
      expect(ctx.operationId).toBe('op-123');
    });
  });

  describe('ThreadContext', () => {
    it('should define thread context structure', () => {
      const ctx: ThreadContext = {
        threadId: 'thread-123',
        eventId: 'event-456',
        causationId: ['cause-1'],
        sequenceNo: 42,
        partitionKey: 'partition-1',
        attempt: 1,
        shardId: 'shard-1',
        workerId: 'worker-1'
      };
      expect(ctx.threadId).toBe('thread-123');
    });
  });

  describe('LoggingConfig', () => {
    it('should accept new configuration options', () => {
      const config: LoggingConfig = {
        logToConsole: true,
        logLevel: 'verbose',
        sanitization: {
          enabled: true,
          maskWith: '[REDACTED]'
        },
        transports: {
          core: 'pino',
          fileRotation: 'winston',
          devPretty: true
        },
        tracing: {
          enableOtelContext: true
        },
        trails: {
          enableDepthTrail: true,
          enableThreadTrail: true
        }
      };
      expect(config.transports?.core).toBe('pino');
      expect(config.trails?.enableDepthTrail).toBe(true);
    });
  });
});
