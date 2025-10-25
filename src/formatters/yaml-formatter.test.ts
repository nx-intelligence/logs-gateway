/**
 * Tests for YAML formatter
 */

import { describe, it, expect } from 'vitest';
import { formatLogEntryAsYaml } from './yaml-formatter';
import type { LogEnvelope } from '../types';

describe('YAML Formatter', () => {
  describe('Basic YAML formatting', () => {
    it('should format a simple log entry as YAML', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test message',
        source: 'application'
      };

      const result = formatLogEntryAsYaml(envelope);
      
      expect(result).toContain('---');
      expect(result).toContain('timestamp: 2025-01-25T10:30:00.000Z');
      expect(result).toContain('package: TEST_APP');
      expect(result).toContain('level: INFO');
      expect(result).toContain('message: Test message');
      expect(result).toContain('source: application');
    });

    it('should format log entry with data as YAML', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'User action',
        source: 'application',
        data: {
          userId: '123',
          action: 'login',
          metadata: {
            ip: '192.168.1.1',
            userAgent: 'Mozilla/5.0'
          }
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      expect(result).toContain('---');
      expect(result).toContain('data:');
      expect(result).toContain('userId: "123"');
      expect(result).toContain('action: login');
      expect(result).toContain('metadata:');
      expect(result).toContain('ip: 192.168.1.1');
    });

    it('should format log entry with all metadata fields', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Complex operation',
        source: 'application',
        correlationId: 'corr-123',
        jobId: 'job-456',
        runId: 'run-789',
        sessionId: 'session-abc',
        operationId: 'op-123',
        parentOperationId: 'op-parent',
        operationName: 'processPayment',
        operationPath: 'payment.process',
        operationStep: 3,
        threadId: 'thread-123',
        eventId: 'event-456',
        causationId: ['event-123', 'event-456'],
        sequenceNo: 42,
        partitionKey: 'user-123',
        attempt: 1,
        shardId: 'shard-1',
        workerId: 'worker-1',
        traceId: 'trace-123',
        spanId: 'span-456',
        tags: ['payment', 'critical'],
        _routing: {
          allowedOutputs: ['console', 'file'],
          reason: 'test routing'
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      expect(result).toContain('---');
      expect(result).toContain('correlationId: corr-123');
      expect(result).toContain('jobId: job-456');
      expect(result).toContain('operationId: op-123');
      expect(result).toContain('threadId: thread-123');
      expect(result).toContain('traceId: trace-123');
      expect(result).toContain('tags:');
      expect(result).toContain('- payment');
      expect(result).toContain('- critical');
      expect(result).toContain('_routing:');
      expect(result).toContain('allowedOutputs:');
    });
  });

  describe('Type safety and string conversion', () => {
    it('should ensure timestamps are strings', () => {
      const envelope: LogEnvelope = {
        timestamp: new Date('2025-01-25T10:30:00.000Z') as any, // Force non-string
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test',
        source: 'application'
      };

      const result = formatLogEntryAsYaml(envelope);
      expect(result).toContain('timestamp: "2025-01-25T10:30:00.000Z"');
    });

    it('should ensure IDs are strings', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test',
        source: 'application',
        traceId: 12345 as any, // Force non-string
        spanId: 67890 as any,  // Force non-string
        operationId: 11111 as any, // Force non-string
        correlationId: 22222 as any // Force non-string
      };

      const result = formatLogEntryAsYaml(envelope);
      expect(result).toContain('traceId: "12345"');
      expect(result).toContain('spanId: "67890"');
      expect(result).toContain('operationId: "11111"');
      expect(result).toContain('correlationId: "22222"');
    });

    it('should ensure numeric fields remain numeric', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test',
        source: 'application',
        sequenceNo: '42' as any, // Force string
        operationStep: '3' as any, // Force string
        attempt: '1' as any // Force string
      };

      const result = formatLogEntryAsYaml(envelope);
      expect(result).toContain('sequenceNo: 42');
      expect(result).toContain('operationStep: 3');
      expect(result).toContain('attempt: 1');
    });
  });

  describe('Sanitization integration', () => {
    it('should preserve sanitized data in YAML output', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'User login',
        source: 'application',
        data: {
          username: 'john',
          password: '[REDACTED]',
          email: '[REDACTED]',
          token: '[REDACTED]',
          _sanitization: {
            redactionCount: 3,
            truncated: false
          }
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      expect(result).toContain('username: john');
      expect(result).toContain('password: "[REDACTED]"');
      expect(result).toContain('email: "[REDACTED]"');
      expect(result).toContain('token: "[REDACTED]"');
      expect(result).toContain('_sanitization:');
      expect(result).toContain('redactionCount: 3');
      expect(result).toContain('truncated: false');
    });
  });

  describe('Error handling and fallback', () => {
    it('should handle circular references gracefully', () => {
      // Create a circular reference (this should be caught by JSON.stringify check)
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test with circular ref',
        source: 'application',
        data: circularData
      };

      // This should not throw, but should fallback to JSON
      const result = formatLogEntryAsYaml(envelope);
      
      // Should be JSON fallback (starts with {, not ---)
      expect(result).toMatch(/^\{/);
      expect(result).toContain('formatFallback');
      expect(result).toContain('yaml→json');
    });

    it('should handle YAML dump errors with fallback', () => {
      // Mock a scenario where yaml.dump would fail
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test',
        source: 'application',
        data: {
          // Create data that might cause YAML issues
          specialChars: 'Special chars: \x00\x01\x02',
          undefinedValue: undefined as any,
          nullValue: null
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      // Should still produce valid output
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('YAML formatting options', () => {
    it('should use proper indentation and line width', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test with long data',
        source: 'application',
        data: {
          longString: 'This is a very long string that should be handled properly by the YAML formatter with appropriate line width settings',
          nested: {
            deeply: {
              nested: {
                object: {
                  with: {
                    many: {
                      levels: 'of nesting'
                    }
                  }
                }
              }
            }
          }
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      // Should start with document separator
      expect(result).toMatch(/^---\n/);
      
      // Should have proper indentation (2 spaces)
      const lines = result.split('\n');
      const dataLine = lines.find(line => line.includes('data:'));
      const nestedLine = lines.find(line => line.includes('nested:'));
      
      expect(dataLine).toMatch(/^  data:/);
      expect(nestedLine).toMatch(/^    nested:/);
    });

    it('should handle arrays properly', () => {
      const envelope: LogEnvelope = {
        timestamp: '2025-01-25T10:30:00.000Z',
        package: 'TEST_APP',
        level: 'INFO',
        message: 'Test with arrays',
        source: 'application',
        data: {
          tags: ['tag1', 'tag2', 'tag3'],
          numbers: [1, 2, 3, 4, 5],
          mixed: ['string', 123, true, null],
          nested: [
            { name: 'item1', value: 1 },
            { name: 'item2', value: 2 }
          ]
        }
      };

      const result = formatLogEntryAsYaml(envelope);
      
      expect(result).toContain('tags:');
      expect(result).toContain('- tag1');
      expect(result).toContain('- tag2');
      expect(result).toContain('- tag3');
      expect(result).toContain('numbers:');
      expect(result).toContain('- 1');
      expect(result).toContain('- 2');
      expect(result).toContain('mixed:');
      expect(result).toContain('- string');
      expect(result).toContain('- 123');
      expect(result).toContain('- true');
      expect(result).toContain('- null');
    });
  });
});
