/**
 * logs-gateway - Unified Logger Output Implementation
 * 
 * This file handles integration with @x-developer/unified-logger for Papertrail/UDP/Console output.
 * 
 * Note: This transport always receives structured data (JSON format) regardless of the 
 * configured logFormat setting. YAML formatting only applies to console and file outputs.
 */

import { initLogger, logger } from '@x-developer/unified-logger';
import type { UnifiedLoggerConfig, LogMeta, LogLevel } from '../types';

/**
 * Unified logger output handler
 */
export class UnifiedLoggerOutput {
  private initialized = false;

  constructor(private readonly cfg: UnifiedLoggerConfig) {}

  /**
   * Initialize the unified logger if not already done
   */
  private ensureInit(): void {
    if (this.initialized) return;

    try {
      if (this.cfg.configPath) {
        initLogger(this.cfg.configPath);
      } else if (this.cfg.configInline) {
        initLogger(this.cfg.configInline);
      } else {
        // Create inline configuration
        const inline = {
          service: this.cfg.service ?? 'logs-gateway',
          env: this.cfg.env ?? process.env.NODE_ENV ?? 'production',
          level: (this.cfg.level ?? 'info').toUpperCase(),
          transports: {
            console: { 
              enabled: this.cfg.transports?.console ?? false 
            },
            papertrail: { 
              enabled: this.cfg.transports?.papertrail ?? false,
              host: process.env.PAPERTRAIL_HOST || '',
              port: Number(process.env.PAPERTRAIL_PORT || 0),
              program: this.cfg.service ?? 'logs-gateway'
            },
            udpRelay: { 
              enabled: this.cfg.transports?.udpRelay ?? false,
              host: process.env.UDP_RELAY_HOST || '127.0.0.1',
              port: Number(process.env.UDP_RELAY_PORT || 0),
              maxPacketBytes: 65000
            }
          }
        };
        initLogger(inline as any);
      }

      this.initialized = true;
    } catch (err) {
      console.error('[logs-gateway] Failed to initialize unified-logger:', err);
      // Don't throw - this is an optional output
    }
  }

  /**
   * Map logs-gateway log levels to unified-logger levels
   */
  private mapLevel(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case 'debug': return 'debug';
      case 'info': return 'info';
      case 'warn': return 'warn';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  /**
   * Write a log entry to unified-logger
   */
  write(level: LogLevel, message: string, meta?: LogMeta): void {
    // Check level filter
    if (this.cfg.levels && !this.cfg.levels.includes(level)) {
      return;
    }

    // Respect routing metadata when present
    if (meta?._routing?.blockOutputs?.includes('unified-logger')) {
      return;
    }
    if (meta?._routing?.allowedOutputs && !meta._routing.allowedOutputs.includes('unified-logger')) {
      return;
    }

    this.ensureInit();

    if (!this.initialized) {
      return; // Failed to initialize, skip silently
    }

    try {
      const mappedLevel = this.mapLevel(level);
      const payload: Record<string, any> = {
        ...meta,
        source: meta?.source ?? 'application'
      };
      
      if (meta?.correlationId) {
        payload.correlationId = meta.correlationId;
      }

      // Remove routing metadata from the payload to avoid noise
      delete payload._routing;

      logger[mappedLevel](message, payload);
    } catch (err) {
      console.error('[logs-gateway] Failed to write to unified-logger:', err);
      // Don't throw - this is an optional output
    }
  }
}
