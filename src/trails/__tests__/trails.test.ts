/**
 * Tests for AsyncLocalStorage trails module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  startOperation,
  childOperation,
  getCurrentOperation,
  newThread,
  continueThread,
  nextEventId,
  getCurrentThread,
  clearAllContexts,
  OperationScope
} from '../index';

describe('Trails Module', () => {
  beforeEach(() => {
    // Clean up any existing contexts
    clearAllContexts();
  });

  afterEach(() => {
    // Clean up after each test
    clearAllContexts();
  });

  describe('Operation Scopes', () => {
    it('should create operation scope with correct properties', () => {
      const scope = startOperation('test-operation', { userId: '123' });
      
      expect(scope).toBeDefined();
      expect(typeof scope.end).toBe('function');
      expect(typeof scope.with).toBe('function');
    });

    it('should track operation hierarchy', () => {
      const parentScope = startOperation('parent-operation');
      const parentOp = getCurrentOperation();
      
      expect(parentOp).toBeDefined();
      expect(parentOp?.operationName).toBe('parent-operation');
      // Note: parentOperationId may be set if there's a previous context
      expect(parentOp?.operationStep).toBe(0);

      const childScope = childOperation('child-operation');
      const childOp = getCurrentOperation();
      
      expect(childOp).toBeDefined();
      expect(childOp?.operationName).toBe('child-operation');
      expect(childOp?.parentOperationId).toBe(parentOp?.operationId);
      expect(childOp?.operationStep).toBe(1);

      childScope.end();
      parentScope.end();
    });

    it('should preserve context across async boundaries', async () => {
      const scope = startOperation('async-operation');
      const initialOp = getCurrentOperation();

      await new Promise(resolve => {
        setTimeout(() => {
          const asyncOp = getCurrentOperation();
          expect(asyncOp?.operationId).toBe(initialOp?.operationId);
          expect(asyncOp?.operationName).toBe('async-operation');
          resolve(undefined);
        }, 10);
      });

      scope.end();
    });

    it('should support nested scopes with with() method', async () => {
      const parentScope = startOperation('parent');
      
      await parentScope.with(async () => {
        const childScope = childOperation('child');
        const op = getCurrentOperation();
        expect(op?.operationName).toBe('child');
        expect(op?.parentOperationId).toBeDefined();
        childScope.end();
      });

      const finalOp = getCurrentOperation();
      expect(finalOp?.operationName).toBe('parent');

      parentScope.end();
    });

    it('should generate unique operation IDs', () => {
      const scope1 = startOperation('op1');
      const op1 = getCurrentOperation();
      scope1.end();
      
      const scope2 = startOperation('op2');
      const op2 = getCurrentOperation();
      scope2.end();
      
      expect(op1?.operationId).not.toBe(op2?.operationId);
    });

    it('should increment operation step for child operations', () => {
      const parent = startOperation('parent');
      expect(getCurrentOperation()?.operationStep).toBe(0);
      
      const child1 = childOperation('child1');
      expect(getCurrentOperation()?.operationStep).toBe(1);
      
      const child2 = childOperation('child2');
      expect(getCurrentOperation()?.operationStep).toBe(2);
      
      child2.end();
      child1.end();
      parent.end();
    });
  });

  describe('Thread Contexts', () => {
    it('should create new thread with initial values', () => {
      const thread = newThread({
        threadId: 'thread-123',
        partitionKey: 'partition-1'
      });
      
      expect(thread.threadId).toBe('thread-123');
      expect(thread.partitionKey).toBe('partition-1');
      expect(thread.sequenceNo).toBe(0);
      expect(thread.eventId).toBeDefined();
    });

    it('should continue thread from existing context', () => {
      const originalThread = newThread({ threadId: 'thread-123' });
      const continuedThread = continueThread({
        threadId: 'thread-123',
        sequenceNo: 5,
        causationId: ['event-1', 'event-2']
      });
      
      expect(continuedThread.threadId).toBe('thread-123');
      expect(continuedThread.sequenceNo).toBe(5);
      expect(continuedThread.causationId).toEqual(['event-1', 'event-2']);
    });

    it('should generate sequential event IDs', () => {
      const thread = newThread({ threadId: 'test-thread' });
      
      const event1 = nextEventId();
      const event2 = nextEventId();
      const event3 = nextEventId();
      
      expect(event1).not.toBe(event2);
      expect(event2).not.toBe(event3);
      expect(event1).toMatch(/^evt_/);
      expect(event2).toMatch(/^evt_/);
      expect(event3).toMatch(/^evt_/);
    });

    it('should increment sequence number with each event', () => {
      const thread = newThread({ threadId: 'test-thread' });
      const initialSeq = thread.sequenceNo;
      
      nextEventId();
      const thread1 = getCurrentThread();
      expect(thread1?.sequenceNo).toBe(initialSeq + 1);
      
      nextEventId();
      const thread2 = getCurrentThread();
      expect(thread2?.sequenceNo).toBe(initialSeq + 2);
    });

    it('should preserve thread context across async boundaries', async () => {
      const thread = newThread({ threadId: 'async-thread' });
      const initialThread = getCurrentThread();
      
      await new Promise(resolve => {
        setTimeout(() => {
          const asyncThread = getCurrentThread();
          expect(asyncThread?.threadId).toBe(initialThread?.threadId);
          expect(asyncThread?.sequenceNo).toBe(initialThread?.sequenceNo);
          resolve(undefined);
        }, 10);
      });
    });

    it('should handle causation chains', () => {
      const thread = newThread({ threadId: 'causation-test' });
      
      const event1 = nextEventId();
      const thread1 = getCurrentThread();
      // First event may have causation from previous context
      expect(thread1?.causationId).toBeDefined();
      
      const event2 = nextEventId();
      const thread2 = getCurrentThread();
      expect(thread2?.causationId).toContain(event1);
      
      const event3 = nextEventId();
      const thread3 = getCurrentThread();
      expect(thread3?.causationId).toContain(event1);
      expect(thread3?.causationId).toContain(event2);
    });
  });

  describe('Integration', () => {
    it('should support both operation and thread contexts simultaneously', () => {
      const thread = newThread({ threadId: 'integration-test' });
      const scope = startOperation('integration-operation');
      
      const op = getCurrentOperation();
      const thr = getCurrentThread();
      
      expect(op).toBeDefined();
      expect(thr).toBeDefined();
      expect(op?.operationName).toBe('integration-operation');
      expect(thr?.threadId).toBe('integration-test');
      
      scope.end();
    });

    it('should handle complex nested scenarios', async () => {
      const thread = newThread({ threadId: 'complex-test' });
      const parentScope = startOperation('parent');
      
      await parentScope.with(async () => {
        const childScope = childOperation('child');
        
        await childScope.with(async () => {
          const grandchildScope = childOperation('grandchild');
          
          const op = getCurrentOperation();
          const thr = getCurrentThread();
          
          expect(op?.operationName).toBe('grandchild');
          expect(op?.operationStep).toBe(2);
          expect(thr?.threadId).toBe('complex-test');
          
          grandchildScope.end();
        });
        
        childScope.end();
      });
      
      parentScope.end();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing context gracefully', () => {
      // Clear contexts first
      clearAllContexts();
      expect(getCurrentOperation()).toBeNull();
      expect(getCurrentThread()).toBeNull();
    });

    it('should handle scope cleanup on errors', () => {
      const scope = startOperation('error-test');
      
      try {
        throw new Error('Test error');
      } catch (error) {
        // Scope should still be available
        const op = getCurrentOperation();
        expect(op?.operationName).toBe('error-test');
        scope.end();
      }
      
      // After end, should be null
      expect(getCurrentOperation()).toBeNull();
    });
  });
});
