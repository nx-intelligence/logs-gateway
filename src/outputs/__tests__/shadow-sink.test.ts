/**
 * Shadow Sink Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShadowSink } from '../shadow-sink';
import { LogEnvelope, ShadowConfig } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

describe('ShadowSink', () => {
  const testDir = './test-shadow-logs';
  const packageName = 'TEST_PKG';

  // Clean up test directory before and after tests
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      expect(sink).toBeDefined();
      expect(sink.listActive()).toEqual([]);
    });

    it('should create shadow directory on initialization if enabled', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      new ShadowSink(config, packageName);
      expect(fs.existsSync(testDir)).toBe(true);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable shadow capture for a runId', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-123');

      expect(sink.isEnabled('test-run-123')).toBe(true);
      expect(sink.listActive()).toHaveLength(1);
      expect(sink.listActive()[0].runId).toBe('test-run-123');
    });

    it('should create run directory and index on enable', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-123');

      const runDir = path.join(testDir, 'test-run-123');
      const indexPath = path.join(runDir, 'index.json');

      expect(fs.existsSync(runDir)).toBe(true);
      expect(fs.existsSync(indexPath)).toBe(true);

      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(index.runId).toBe('test-run-123');
      expect(index.format).toBe('json');
      expect(index.entryCount).toBe(0);
    });

    it('should disable shadow capture for a runId', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-123');
      expect(sink.isEnabled('test-run-123')).toBe(true);

      sink.disable('test-run-123');
      expect(sink.isEnabled('test-run-123')).toBe(false);
      expect(sink.listActive()).toHaveLength(0);
    });

    it('should support custom format option on enable', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-yaml', { format: 'yaml' });

      const active = sink.listActive();
      expect(active[0].format).toBe('yaml');
    });
  });

  describe('Log Capture', () => {
    it('should capture logs matching runId', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-123');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Test message',
        source: 'test',
        runId: 'test-run-123'
      };

      const rawData = { key: 'value', secret: 'password123' };
      sink.write(envelope, rawData);

      const filePath = path.join(testDir, 'test-run-123', 'test-run-123.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const logged = JSON.parse(lines[0]);
      expect(logged.message).toBe('Test message');
      expect(logged.runId).toBe('test-run-123');
      expect(logged.data.secret).toBe('password123'); // Raw, unsanitized
    });

    it('should not capture logs with non-matching runId', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-123');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Test message',
        source: 'test',
        runId: 'different-run-456'
      };

      sink.write(envelope, { key: 'value' });

      const filePath = path.join(testDir, 'test-run-123', 'test-run-123.jsonl');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should capture logs with _shadow.runId override', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('override-run');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Test message',
        source: 'test',
        runId: 'normal-run',
        data: {
          _shadow: { runId: 'override-run' }
        }
      };

      sink.write(envelope, { _shadow: { runId: 'override-run' } });

      const filePath = path.join(testDir, 'override-run', 'override-run.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should write YAML format when configured', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        format: 'yaml'
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-yaml', { format: 'yaml' });

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Test YAML',
        source: 'test',
        runId: 'test-run-yaml'
      };

      sink.write(envelope, { key: 'yaml-value' });

      const filePath = path.join(testDir, 'test-run-yaml', 'test-run-yaml.yaml');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('---');
      expect(content).toContain('message: Test YAML');
    });

    it('should update entry count in index', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-count');

      for (let i = 0; i < 5; i++) {
        const envelope: LogEnvelope = {
          timestamp: new Date().toISOString(),
          package: packageName,
          level: 'INFO',
          message: `Message ${i}`,
          source: 'test',
          runId: 'test-run-count'
        };
        sink.write(envelope, {});
      }

      const indexPath = path.join(testDir, 'test-run-count', 'index.json');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(index.entryCount).toBe(5);
    });
  });

  describe('Routing Blocks', () => {
    it('should respect routing blockOutputs for "file" by default', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        respectRoutingBlocks: true
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-block');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Blocked message',
        source: 'test',
        runId: 'test-run-block',
        _routing: {
          blockOutputs: ['file']
        }
      };

      sink.write(envelope, {});

      const filePath = path.join(testDir, 'test-run-block', 'test-run-block.jsonl');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should respect routing blockOutputs for "shadow"', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        respectRoutingBlocks: true
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-shadow-block');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Shadow blocked',
        source: 'test',
        runId: 'test-run-shadow-block',
        _routing: {
          blockOutputs: ['shadow']
        }
      };

      sink.write(envelope, {});

      const filePath = path.join(testDir, 'test-run-shadow-block', 'test-run-shadow-block.jsonl');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should ignore routing blocks when respectRoutingBlocks is false', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        respectRoutingBlocks: false
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-no-respect');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Force captured',
        source: 'test',
        runId: 'test-run-no-respect',
        _routing: {
          blockOutputs: ['file', 'shadow']
        }
      };

      sink.write(envelope, {});

      const filePath = path.join(testDir, 'test-run-no-respect', 'test-run-no-respect.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Rolling Buffer', () => {
    it('should buffer logs when maxEntries is set', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        rollingBuffer: {
          maxEntries: 10
        }
      };

      const sink = new ShadowSink(config, packageName);

      // Write logs before enabling
      for (let i = 0; i < 5; i++) {
        const envelope: LogEnvelope = {
          timestamp: new Date().toISOString(),
          package: packageName,
          level: 'INFO',
          message: `Buffered message ${i}`,
          source: 'test',
          runId: 'test-run-buffer'
        };
        sink.write(envelope, { index: i });
      }

      // Enable capture - should flush buffer
      sink.enable('test-run-buffer');

      const filePath = path.join(testDir, 'test-run-buffer', 'test-run-buffer.jsonl');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(5);
    });

    it('should limit buffer size to maxEntries', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        rollingBuffer: {
          maxEntries: 3
        }
      };

      const sink = new ShadowSink(config, packageName);

      // Write more logs than buffer size
      for (let i = 0; i < 10; i++) {
        const envelope: LogEnvelope = {
          timestamp: new Date().toISOString(),
          package: packageName,
          level: 'INFO',
          message: `Message ${i}`,
          source: 'test',
          runId: 'test-run-limit'
        };
        sink.write(envelope, { index: i });
      }

      // Enable capture - should only have last 3
      sink.enable('test-run-limit');

      const filePath = path.join(testDir, 'test-run-limit', 'test-run-limit.jsonl');
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(3);

      // Should have messages 7, 8, 9
      const logged = lines.map(line => JSON.parse(line));
      expect(logged[0].data.index).toBe(7);
      expect(logged[1].data.index).toBe(8);
      expect(logged[2].data.index).toBe(9);
    });
  });

  describe('Export', () => {
    it('should export shadow file to destination', async () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-export');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Export test',
        source: 'test',
        runId: 'test-run-export'
      };
      sink.write(envelope, {});

      const exportPath = path.join(testDir, 'exported.jsonl');
      const result = await sink.export('test-run-export', exportPath);

      expect(result).toBe(exportPath);
      expect(fs.existsSync(exportPath)).toBe(true);

      const content = fs.readFileSync(exportPath, 'utf8');
      expect(content).toContain('Export test');
    });

    it('should throw error when exporting non-existent runId', async () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);

      await expect(sink.export('non-existent')).rejects.toThrow();
    });
  });

  describe('TTL Cleanup', () => {
    it('should delete expired runs', async () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        ttlMs: 1000 // 1 second
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-expire', { ttlMs: 1000 });

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Will expire',
        source: 'test',
        runId: 'test-run-expire'
      };
      sink.write(envelope, {});

      const runDir = path.join(testDir, 'test-run-expire');
      expect(fs.existsSync(runDir)).toBe(true);

      // Simulate time passing (2 seconds in future)
      const futureTime = Date.now() + 2000;
      const deleted = await sink.cleanupExpired(futureTime);

      expect(deleted).toBe(1);
      expect(fs.existsSync(runDir)).toBe(false);
    });

    it('should not delete non-expired runs', async () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir,
        ttlMs: 86400000 // 1 day
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-fresh');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Fresh log',
        source: 'test',
        runId: 'test-run-fresh'
      };
      sink.write(envelope, {});

      const deleted = await sink.cleanupExpired();

      expect(deleted).toBe(0);
      const runDir = path.join(testDir, 'test-run-fresh');
      expect(fs.existsSync(runDir)).toBe(true);
    });
  });

  describe('Raw Data Capture', () => {
    it('should capture unsanitized raw data', () => {
      const config: ShadowConfig = {
        enabled: true,
        directory: testDir
      };

      const sink = new ShadowSink(config, packageName);
      sink.enable('test-run-raw');

      const envelope: LogEnvelope = {
        timestamp: new Date().toISOString(),
        package: packageName,
        level: 'INFO',
        message: 'Raw data test',
        source: 'test',
        runId: 'test-run-raw'
      };

      const rawData = {
        email: 'user@example.com',
        password: 'secret123',
        apiKey: 'sk_live_abc123xyz'
      };

      sink.write(envelope, rawData);

      const filePath = path.join(testDir, 'test-run-raw', 'test-run-raw.jsonl');
      const content = fs.readFileSync(filePath, 'utf8');
      const logged = JSON.parse(content.trim());

      // All raw data should be present
      expect(logged.data.email).toBe('user@example.com');
      expect(logged.data.password).toBe('secret123');
      expect(logged.data.apiKey).toBe('sk_live_abc123xyz');
    });
  });
});

