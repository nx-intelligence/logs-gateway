/**
 * Tests for header injection/extraction functionality
 */

import { describe, it, expect } from 'vitest';
import {
  injectThreadHeaders,
  extractThreadHeaders,
  injectOperationHeaders,
  extractOperationHeaders
} from '../headers';

describe('Header Injection/Extraction', () => {
  describe('Thread Headers', () => {
    it('should inject thread context to headers', () => {
      const headers: Record<string, string> = {};
      const threadContext = {
        threadId: 'thread-123',
        eventId: 'event-456',
        causationId: ['cause-1', 'cause-2'],
        sequenceNo: 42,
        partitionKey: 'partition-1',
        attempt: 1,
        shardId: 'shard-1',
        workerId: 'worker-1'
      };

      injectThreadHeaders(headers, threadContext);

      expect(headers['x-thread-id']).toBe('thread-123');
      expect(headers['x-event-id']).toBe('event-456');
      expect(headers['x-causation-id']).toBe('cause-1,cause-2');
      expect(headers['x-seq-no']).toBe('42');
      expect(headers['x-partition-key']).toBe('partition-1');
      expect(headers['x-attempt']).toBe('1');
      expect(headers['x-shard-id']).toBe('shard-1');
      expect(headers['x-worker-id']).toBe('worker-1');
    });

    it('should handle single causation ID', () => {
      const headers: Record<string, string> = {};
      const threadContext = {
        threadId: 'thread-123',
        eventId: 'event-456',
        causationId: 'single-cause',
        sequenceNo: 42
      };

      injectThreadHeaders(headers, threadContext);

      expect(headers['x-causation-id']).toBe('single-cause');
    });

    it('should handle missing optional fields', () => {
      const headers: Record<string, string> = {};
      const threadContext = {
        threadId: 'thread-123',
        eventId: 'event-456',
        sequenceNo: 42
      };

      injectThreadHeaders(headers, threadContext);

      expect(headers['x-thread-id']).toBe('thread-123');
      expect(headers['x-event-id']).toBe('event-456');
      expect(headers['x-seq-no']).toBe('42');
      expect(headers['x-causation-id']).toBeUndefined();
      expect(headers['x-partition-key']).toBeUndefined();
    });

    it('should extract thread context from headers', () => {
      const headers = {
        'x-thread-id': 'thread-123',
        'x-event-id': 'event-456',
        'x-causation-id': 'cause-1,cause-2',
        'x-seq-no': '42',
        'x-partition-key': 'partition-1',
        'x-attempt': '1',
        'x-shard-id': 'shard-1',
        'x-worker-id': 'worker-1'
      };

      const extracted = extractThreadHeaders(headers);

      expect(extracted.threadId).toBe('thread-123');
      expect(extracted.eventId).toBe('event-456');
      expect(extracted.causationId).toEqual(['cause-1', 'cause-2']);
      expect(extracted.sequenceNo).toBe(42);
      expect(extracted.partitionKey).toBe('partition-1');
      expect(extracted.attempt).toBe(1);
      expect(extracted.shardId).toBe('shard-1');
      expect(extracted.workerId).toBe('worker-1');
    });

    it('should handle missing headers gracefully', () => {
      const headers: Record<string, string> = {};
      const extracted = extractThreadHeaders(headers);

      expect(extracted.threadId).toBeUndefined();
      expect(extracted.eventId).toBeUndefined();
      expect(extracted.sequenceNo).toBeUndefined();
    });

    it('should handle malformed sequence number', () => {
      const headers = {
        'x-thread-id': 'thread-123',
        'x-seq-no': 'invalid'
      };

      const extracted = extractThreadHeaders(headers);

      expect(extracted.threadId).toBe('thread-123');
      expect(extracted.sequenceNo).toBeUndefined();
    });

    it('should handle malformed attempt number', () => {
      const headers = {
        'x-thread-id': 'thread-123',
        'x-attempt': 'invalid'
      };

      const extracted = extractThreadHeaders(headers);

      expect(extracted.threadId).toBe('thread-123');
      expect(extracted.attempt).toBeUndefined();
    });
  });

  describe('Operation Headers', () => {
    it('should inject operation context to headers', () => {
      const headers: Record<string, string> = {};
      const operationContext = {
        operationId: 'op-123',
        parentOperationId: 'op-456',
        operationName: 'test-operation',
        operationPath: 'test.operation',
        operationStep: 1,
        traceId: 'trace-123',
        spanId: 'span-456'
      };

      injectOperationHeaders(headers, operationContext);

      expect(headers['x-operation-id']).toBe('op-123');
      expect(headers['x-parent-operation-id']).toBe('op-456');
      expect(headers['x-operation-name']).toBe('test-operation');
      expect(headers['x-operation-path']).toBe('test.operation');
      expect(headers['x-operation-step']).toBe('1');
      expect(headers['x-trace-id']).toBe('trace-123');
      expect(headers['x-span-id']).toBe('span-456');
    });

    it('should handle missing parent operation', () => {
      const headers: Record<string, string> = {};
      const operationContext = {
        operationId: 'op-123',
        operationName: 'root-operation',
        operationPath: 'root',
        operationStep: 0,
        traceId: 'trace-123',
        spanId: 'span-456'
      };

      injectOperationHeaders(headers, operationContext);

      expect(headers['x-operation-id']).toBe('op-123');
      expect(headers['x-parent-operation-id']).toBeUndefined();
    });

    it('should extract operation context from headers', () => {
      const headers = {
        'x-operation-id': 'op-123',
        'x-parent-operation-id': 'op-456',
        'x-operation-name': 'test-operation',
        'x-operation-path': 'test.operation',
        'x-operation-step': '1',
        'x-trace-id': 'trace-123',
        'x-span-id': 'span-456'
      };

      const extracted = extractOperationHeaders(headers);

      expect(extracted.operationId).toBe('op-123');
      expect(extracted.parentOperationId).toBe('op-456');
      expect(extracted.operationName).toBe('test-operation');
      expect(extracted.operationPath).toBe('test.operation');
      expect(extracted.operationStep).toBe(1);
      expect(extracted.traceId).toBe('trace-123');
      expect(extracted.spanId).toBe('span-456');
    });

    it('should handle malformed operation step', () => {
      const headers = {
        'x-operation-id': 'op-123',
        'x-operation-step': 'invalid'
      };

      const extracted = extractOperationHeaders(headers);

      expect(extracted.operationId).toBe('op-123');
      expect(extracted.operationStep).toBeUndefined();
    });
  });

  describe('Integration', () => {
    it('should handle both thread and operation headers together', () => {
      const headers: Record<string, string> = {};
      
      const threadContext = {
        threadId: 'thread-123',
        eventId: 'event-456',
        sequenceNo: 42
      };
      
      const operationContext = {
        operationId: 'op-123',
        operationName: 'test-operation',
        operationPath: 'test',
        operationStep: 0,
        traceId: 'trace-123',
        spanId: 'span-456'
      };

      injectThreadHeaders(headers, threadContext);
      injectOperationHeaders(headers, operationContext);

      expect(headers['x-thread-id']).toBe('thread-123');
      expect(headers['x-operation-id']).toBe('op-123');
      expect(Object.keys(headers)).toHaveLength(9); // 3 thread + 6 operation headers
    });
  });
});
