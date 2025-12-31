/**
 * logs-gateway - Table Formatter
 * 
 * This file contains the table formatting logic for console log entries.
 */

import type { LogEnvelope } from '../types';

/**
 * Format a log entry as a table row for console output
 * 
 * @param envelope - The log envelope to format
 * @returns Formatted table row object
 */
export function formatLogEntryAsTable(envelope: LogEnvelope): Record<string, any> {
  const row: Record<string, any> = {
    Time: formatTimestamp(envelope.timestamp),
    Level: formatLevel(envelope.level),
    Package: envelope.package,
    Message: envelope.message,
  };

  // Add source if present
  if (envelope.source && envelope.source !== 'application') {
    row.Source = envelope.source;
  }

  // Add app name/version if present
  if (envelope.appName) {
    row.App = envelope.appName;
  }
  if (envelope.appVersion) {
    row.Version = envelope.appVersion;
  }

  // Add correlation ID if present
  if (envelope.correlationId) {
    row.Correlation = envelope.correlationId;
  }

  // Add job/run/session IDs if present
  if (envelope.jobId) {
    row.Job = envelope.jobId;
  }
  if (envelope.runId) {
    row.Run = envelope.runId;
  }
  if (envelope.sessionId) {
    row.Session = envelope.sessionId;
  }

  // Add operation info if present
  if (envelope.operationName) {
    row.Operation = envelope.operationName;
  }

  // Add thread info if present
  if (envelope.threadId) {
    row.Thread = envelope.threadId;
  }

  // Add trace/span if present
  if (envelope.traceId) {
    row.Trace = envelope.traceId.substring(0, 8); // Short trace ID
  }
  if (envelope.spanId) {
    row.Span = envelope.spanId.substring(0, 8); // Short span ID
  }

  // Add data summary if present
  if (envelope.data) {
    const dataStr = formatDataSummary(envelope.data);
    if (dataStr) {
      row.Data = dataStr;
    }
  }

  // Add tags if present
  if (envelope.tags && envelope.tags.length > 0) {
    row.Tags = envelope.tags.join(', ');
  }

  return row;
}

/**
 * Format timestamp to a shorter, more readable format
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  } catch {
    return timestamp;
  }
}

/**
 * Format log level with color indicators (for display)
 */
function formatLevel(level: string): string {
  const levelUpper = level.toUpperCase();
  // Return level with emoji indicators for better visibility
  const indicators: Record<string, string> = {
    'VERBOSE': '🔍',
    'DEBUG': '🐛',
    'INFO': 'ℹ️',
    'WARN': '⚠️',
    'ERROR': '❌'
  };
  return `${indicators[levelUpper] || ''} ${levelUpper}`;
}

/**
 * Format data object to a compact string summary
 */
function formatDataSummary(data: any): string {
  if (!data || typeof data !== 'object') {
    return String(data);
  }

  try {
    // Remove internal/routing fields from summary
    const { _routing, _sanitization, _shadow, source, ...rest } = data;
    
    // If no meaningful data left, return empty
    if (Object.keys(rest).length === 0) {
      return '';
    }

    // Create a compact summary
    const entries = Object.entries(rest).slice(0, 3); // Limit to first 3 fields
    const summary = entries.map(([key, value]) => {
      const valStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 30) : String(value);
      return `${key}:${valStr.length > 30 ? valStr.substring(0, 30) + '...' : valStr}`;
    }).join(', ');

    return summary.length > 80 ? summary.substring(0, 80) + '...' : summary;
  } catch {
    return '[object]';
  }
}

/**
 * Output log entry as a simple text line (conceptual table format)
 * Each log entry is displayed as a single line with key fields.
 * No truncation - full message is shown. Terminal will handle wrapping if configured.
 * 
 * @param envelope - The log envelope to format
 * @param showFullTimestamp - If true, show full ISO timestamp; if false, show short time format (default: false)
 */
export function outputLogAsTable(envelope: LogEnvelope, showFullTimestamp: boolean = false): void {
  const parts: string[] = [];
  
  // Time format - full ISO timestamp or short format
  const time = showFullTimestamp ? envelope.timestamp : formatTimestamp(envelope.timestamp);
  parts.push(`[${time}]`);
  
  // Level with indicator - fixed width for alignment
  const level = formatLevel(envelope.level);
  // Pad level to consistent width (accounting for emoji + space)
  const levelPadded = level.padEnd(8);
  parts.push(levelPadded);
  
  // Package - fixed width bracket format
  parts.push(`[${envelope.package}]`);
  
  // Message - FULL LENGTH, no truncation
  // User can scroll horizontally if needed, or scroll down if not interested
  parts.push(envelope.message);
  
  // Optional metadata fields (compact format, separated by pipe)
  const metadataParts: string[] = [];
  
  if (envelope.appName) {
    metadataParts.push(`app:${envelope.appName}`);
  }
  if (envelope.appVersion) {
    metadataParts.push(`v:${envelope.appVersion}`);
  }
  if (envelope.source && envelope.source !== 'application') {
    metadataParts.push(`src:${envelope.source}`);
  }
  if (envelope.correlationId) {
    metadataParts.push(`corr:${envelope.correlationId}`);
  }
  if (envelope.jobId) {
    metadataParts.push(`job:${envelope.jobId}`);
  }
  if (envelope.runId) {
    metadataParts.push(`run:${envelope.runId}`);
  }
  if (envelope.sessionId) {
    metadataParts.push(`session:${envelope.sessionId}`);
  }
  if (envelope.operationName) {
    metadataParts.push(`op:${envelope.operationName}`);
  }
  if (envelope.threadId) {
    metadataParts.push(`thread:${envelope.threadId}`);
  }
  if (envelope.traceId) {
    metadataParts.push(`trace:${envelope.traceId}`);
  }
  if (envelope.spanId) {
    metadataParts.push(`span:${envelope.spanId}`);
  }
  if (envelope.tags && envelope.tags.length > 0) {
    metadataParts.push(`tags:${envelope.tags.join(',')}`);
  }
  if (envelope.identity) {
    metadataParts.push(`identity:${envelope.identity}`);
  }
  
  // Add metadata section if present (separated by pipe for visual clarity)
  if (metadataParts.length > 0) {
    parts.push(`| ${metadataParts.join(' ')}`);
  }
  
  // Data section (if present) - FULL data, no truncation
  // Separated by double pipe for visual distinction
  if (envelope.data) {
    try {
      // Format data as compact JSON (single line, no pretty printing)
      const dataJson = JSON.stringify(envelope.data);
      parts.push(`|| ${dataJson}`);
    } catch {
      // If JSON.stringify fails, use string representation
      parts.push(`|| ${String(envelope.data)}`);
    }
  }
  
  // Output as single line - terminal will handle wrapping naturally
  // No forced wrapping - user controls via terminal settings or horizontal scrolling
  console.log(parts.join(' '));
}

