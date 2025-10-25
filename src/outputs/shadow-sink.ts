/**
 * Shadow Sink - Per-run debug capture to separate files
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogEnvelope, ShadowConfig, ShadowController } from '../types';
import { formatLogEntryAsYaml } from '../formatters/yaml-formatter';

/**
 * Metadata for an active shadow capture
 */
interface ShadowRunMeta {
  runId: string;
  enabledAt: string;
  format: 'json' | 'yaml';
  directory: string;
  ttlMs: number;
  respectRoutingBlocks: boolean;
  entryCount: number;
}

/**
 * Buffered envelope entry for rolling buffer
 */
interface BufferedEntry {
  envelope: LogEnvelope;
  rawData: any;
  timestamp: number;
}

/**
 * Index manifest structure
 */
interface ShadowIndex {
  runId: string;
  createdAt: string;
  updatedAt: string;
  ttlMs: number;
  format: 'json' | 'yaml';
  entryCount: number;
  filePath: string;
  meta: {
    host: string;
    pid: number;
    package: string;
  };
}

/**
 * ShadowSink captures logs for specific runIds to separate files
 */
export class ShadowSink implements ShadowController {
  private config: Required<ShadowConfig>;
  private activeRuns: Map<string, ShadowRunMeta> = new Map();
  private rollingBuffer: BufferedEntry[] = [];
  private packageName: string;

  constructor(config: ShadowConfig, packageName: string) {
    // Set defaults
    this.config = {
      enabled: config.enabled ?? false,
      format: config.format ?? 'json',
      directory: config.directory ?? './logs/shadow',
      ttlMs: config.ttlMs ?? 86_400_000, // 1 day
      respectRoutingBlocks: config.respectRoutingBlocks ?? true,
      rollingBuffer: {
        maxEntries: config.rollingBuffer?.maxEntries ?? 0,
        maxAgeMs: config.rollingBuffer?.maxAgeMs ?? 0
      }
    };
    this.packageName = packageName;

    // Ensure shadow directory exists
    if (this.config.enabled) {
      this.ensureDirectory(this.config.directory);
    }
  }

  /**
   * Write a log entry to shadow if eligible
   */
  write(envelope: LogEnvelope, rawData: any): void {
    // Add to rolling buffer if configured
    if (this.config.rollingBuffer.maxEntries > 0) {
      this.addToBuffer(envelope, rawData);
    }

    // Check if this log should be captured
    if (!this.shouldCapture(envelope)) {
      return;
    }

    // Find the runId to capture to
    const targetRunId = this.getTargetRunId(envelope);
    if (!targetRunId) {
      return;
    }

    // Get run metadata
    const runMeta = this.activeRuns.get(targetRunId);
    if (!runMeta) {
      return;
    }

    // Write to file
    try {
      this.writeToFile(runMeta, envelope, rawData);
      runMeta.entryCount++;
      this.updateIndex(runMeta);
    } catch (err) {
      // Silent failure - don't disrupt primary logging
      console.error(`[logs-gateway] Shadow sink write error for runId=${targetRunId}:`, err);
    }
  }

  /**
   * Enable shadow capture for a specific runId
   */
  enable(runId: string, opts?: Partial<ShadowConfig>): void {
    // Merge options with defaults
    const format = opts?.format ?? this.config.format;
    const directory = opts?.directory ?? this.config.directory;
    const ttlMs = opts?.ttlMs ?? this.config.ttlMs;
    const respectRoutingBlocks = opts?.respectRoutingBlocks ?? this.config.respectRoutingBlocks;

    // Create run metadata
    const runMeta: ShadowRunMeta = {
      runId,
      enabledAt: new Date().toISOString(),
      format,
      directory,
      ttlMs,
      respectRoutingBlocks,
      entryCount: 0
    };

    // Ensure directory exists
    const runDir = path.join(directory, runId);
    this.ensureDirectory(runDir);

    // Initialize index
    this.initializeIndex(runMeta);

    // Store metadata
    this.activeRuns.set(runId, runMeta);

    // Flush rolling buffer for this runId
    this.flushBufferForRunId(runId, runMeta);
  }

  /**
   * Disable shadow capture for a specific runId
   */
  disable(runId: string): void {
    const runMeta = this.activeRuns.get(runId);
    if (!runMeta) {
      return;
    }

    // Final index update
    this.updateIndex(runMeta);

    // Remove from active runs
    this.activeRuns.delete(runId);
  }

  /**
   * Check if shadow capture is enabled for a runId
   */
  isEnabled(runId: string): boolean {
    return this.activeRuns.has(runId);
  }

  /**
   * List all active shadow captures
   */
  listActive(): { runId: string; since: string; format: 'json' | 'yaml' }[] {
    return Array.from(this.activeRuns.values()).map(meta => ({
      runId: meta.runId,
      since: meta.enabledAt,
      format: meta.format
    }));
  }

  /**
   * Export shadow file to a destination path
   */
  async export(runId: string, outPath?: string): Promise<string> {
    const runMeta = this.activeRuns.get(runId);
    if (!runMeta) {
      throw new Error(`Shadow capture not found for runId: ${runId}`);
    }

    const sourceFile = this.getFilePath(runMeta);
    const destPath = outPath ?? path.join(process.cwd(), `${runId}.${runMeta.format === 'yaml' ? 'yaml' : 'jsonl'}`);

    // Copy file
    await fs.promises.copyFile(sourceFile, destPath);
    return destPath;
  }

  /**
   * Clean up expired shadow files based on TTL
   */
  async cleanupExpired(now?: number): Promise<number> {
    const currentTime = now ?? Date.now();
    let deletedCount = 0;

    try {
      // Scan shadow directory
      const entries = await fs.promises.readdir(this.config.directory, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const runDir = path.join(this.config.directory, entry.name);
        const indexPath = path.join(runDir, 'index.json');

        // Check if index exists
        if (!fs.existsSync(indexPath)) {
          continue;
        }

        // Read index
        const indexContent = await fs.promises.readFile(indexPath, 'utf8');
        const index: ShadowIndex = JSON.parse(indexContent);

        // Check if expired
        const updatedAt = new Date(index.updatedAt).getTime();
        const expiresAt = updatedAt + index.ttlMs;

        if (expiresAt < currentTime) {
          // Delete directory
          await fs.promises.rm(runDir, { recursive: true, force: true });
          deletedCount++;
        }
      }
    } catch (err) {
      console.error('[logs-gateway] Shadow cleanup error:', err);
    }

    return deletedCount;
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Check if a log should be captured to shadow
   */
  private shouldCapture(envelope: LogEnvelope): boolean {
    // Check if shadow is globally enabled
    if (!this.config.enabled && this.activeRuns.size === 0) {
      return false;
    }

    // Check routing blocks if configured
    if (this.config.respectRoutingBlocks) {
      if (envelope._routing?.blockOutputs?.includes('file') || 
          envelope._routing?.blockOutputs?.includes('shadow')) {
        return false;
      }
    }

    // Check if there's a matching runId
    const targetRunId = this.getTargetRunId(envelope);
    return targetRunId !== null && this.activeRuns.has(targetRunId);
  }

  /**
   * Get the target runId for this log entry
   */
  private getTargetRunId(envelope: LogEnvelope): string | null {
    // Check per-entry override first
    if (envelope.data?._shadow?.runId) {
      return envelope.data._shadow.runId;
    }

    // Check envelope runId
    if (envelope.runId) {
      return envelope.runId;
    }

    return null;
  }

  /**
   * Add entry to rolling buffer
   */
  private addToBuffer(envelope: LogEnvelope, rawData: any): void {
    const { maxEntries, maxAgeMs } = this.config.rollingBuffer;

    if (maxEntries === 0) {
      return;
    }

    // Add to buffer
    this.rollingBuffer.push({
      envelope,
      rawData,
      timestamp: Date.now()
    });

    // Trim by size
    if (this.rollingBuffer.length > maxEntries) {
      this.rollingBuffer.shift();
    }

    // Trim by age
    if (maxAgeMs > 0) {
      const cutoff = Date.now() - maxAgeMs;
      this.rollingBuffer = this.rollingBuffer.filter(entry => entry.timestamp >= cutoff);
    }
  }

  /**
   * Flush rolling buffer for a specific runId
   */
  private flushBufferForRunId(runId: string, runMeta: ShadowRunMeta): void {
    // Filter buffer for matching runId
    const matchingEntries = this.rollingBuffer.filter(entry => {
      const targetRunId = this.getTargetRunId(entry.envelope);
      return targetRunId === runId;
    });

    // Write all matching entries
    for (const entry of matchingEntries) {
      try {
        this.writeToFile(runMeta, entry.envelope, entry.rawData);
        runMeta.entryCount++;
      } catch (err) {
        console.error(`[logs-gateway] Shadow buffer flush error for runId=${runId}:`, err);
      }
    }

    // Update index after flushing
    if (matchingEntries.length > 0) {
      this.updateIndex(runMeta);
    }
  }

  /**
   * Write a log entry to the shadow file
   */
  private writeToFile(runMeta: ShadowRunMeta, envelope: LogEnvelope, rawData: any): void {
    const filePath = this.getFilePath(runMeta);

    // Create envelope with raw data
    const shadowEnvelope: LogEnvelope = {
      ...envelope,
      data: rawData // Use unsanitized raw data
    };

    let content: string;
    if (runMeta.format === 'yaml') {
      content = formatLogEntryAsYaml(shadowEnvelope) + '\n';
    } else {
      // JSONL format
      content = JSON.stringify(shadowEnvelope) + '\n';
    }

    fs.appendFileSync(filePath, content, 'utf8');
  }

  /**
   * Get the file path for a shadow run
   */
  private getFilePath(runMeta: ShadowRunMeta): string {
    const runDir = path.join(runMeta.directory, runMeta.runId);
    const ext = runMeta.format === 'yaml' ? 'yaml' : 'jsonl';
    return path.join(runDir, `${runMeta.runId}.${ext}`);
  }

  /**
   * Initialize index.json for a new shadow run
   */
  private initializeIndex(runMeta: ShadowRunMeta): void {
    const runDir = path.join(runMeta.directory, runMeta.runId);
    const indexPath = path.join(runDir, 'index.json');

    const index: ShadowIndex = {
      runId: runMeta.runId,
      createdAt: runMeta.enabledAt,
      updatedAt: runMeta.enabledAt,
      ttlMs: runMeta.ttlMs,
      format: runMeta.format,
      entryCount: 0,
      filePath: `${runMeta.runId}.${runMeta.format === 'yaml' ? 'yaml' : 'jsonl'}`,
      meta: {
        host: require('os').hostname(),
        pid: process.pid,
        package: this.packageName
      }
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * Update index.json for a shadow run
   */
  private updateIndex(runMeta: ShadowRunMeta): void {
    const runDir = path.join(runMeta.directory, runMeta.runId);
    const indexPath = path.join(runDir, 'index.json');

    try {
      // Read existing index
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      const index: ShadowIndex = JSON.parse(indexContent);

      // Update fields
      index.updatedAt = new Date().toISOString();
      index.entryCount = runMeta.entryCount;

      // Write back
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    } catch (err) {
      console.error(`[logs-gateway] Shadow index update error for runId=${runMeta.runId}:`, err);
    }
  }

  /**
   * Ensure a directory exists
   */
  private ensureDirectory(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error(`[logs-gateway] Failed to create shadow directory ${dir}:`, err);
    }
  }
}

