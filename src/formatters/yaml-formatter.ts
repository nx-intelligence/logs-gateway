/**
 * logs-gateway - YAML Formatter
 * 
 * This file contains the YAML formatting logic for log entries.
 */

import * as yaml from 'js-yaml';
import type { LogEnvelope } from '../types';

/**
 * Format a log envelope as YAML
 * 
 * @param envelope - The log envelope to format
 * @returns Formatted YAML string with document separator
 */
export function formatLogEntryAsYaml(envelope: LogEnvelope): string {
  try {
    // Ensure no circular references by attempting safe stringify first
    // This should never fail since sanitization already handles circular refs
    JSON.stringify(envelope);
    
    // Ensure timestamps and IDs are strings to avoid YAML implicit typing
    const safeEnvelope = ensureStringTypes(envelope);
    
    // Format as YAML with safe options
    const yamlContent = yaml.dump(safeEnvelope, {
      noRefs: true,        // No references/anchors for readability & ingest safety
      skipInvalid: true,   // Skip invalid values
      indent: 2,           // 2-space indentation
      lineWidth: 120,      // Line width limit
      noCompatMode: true,  // Use modern YAML features
      quotingType: '"',    // Use double quotes for strings
      forceQuotes: false   // Only quote when necessary
    });
    
    // Add document separator prefix for multi-document YAML
    return `---\n${yamlContent}`;
  } catch (error) {
    // Fallback to JSON if YAML formatting fails
    const fallbackEnvelope = {
      ...envelope,
      data: {
        ...envelope.data,
        __meta: {
          ...envelope.data?.__meta,
          formatFallback: 'yaml→json'
        }
      }
    };
    
    return JSON.stringify(fallbackEnvelope);
  }
}

/**
 * Ensure timestamps and IDs are strings to avoid YAML implicit typing issues
 */
function ensureStringTypes(envelope: LogEnvelope): LogEnvelope {
  const safe = { ...envelope };
  
  // Ensure timestamp is string (should already be ISO string)
  if (safe.timestamp && typeof safe.timestamp !== 'string') {
    safe.timestamp = new Date(safe.timestamp).toISOString();
  }
  
  // Ensure trace/span IDs are strings
  if (safe.traceId && typeof safe.traceId !== 'string') {
    safe.traceId = String(safe.traceId);
  }
  if (safe.spanId && typeof safe.spanId !== 'string') {
    safe.spanId = String(safe.spanId);
  }
  
  // Ensure operation/thread IDs are strings
  if (safe.operationId && typeof safe.operationId !== 'string') {
    safe.operationId = String(safe.operationId);
  }
  if (safe.threadId && typeof safe.threadId !== 'string') {
    safe.threadId = String(safe.threadId);
  }
  if (safe.eventId && typeof safe.eventId !== 'string') {
    safe.eventId = String(safe.eventId);
  }
  
  // Ensure correlation/job/session IDs are strings
  if (safe.correlationId && typeof safe.correlationId !== 'string') {
    safe.correlationId = String(safe.correlationId);
  }
  if (safe.jobId && typeof safe.jobId !== 'string') {
    safe.jobId = String(safe.jobId);
  }
  if (safe.runId && typeof safe.runId !== 'string') {
    safe.runId = String(safe.runId);
  }
  if (safe.sessionId && typeof safe.sessionId !== 'string') {
    safe.sessionId = String(safe.sessionId);
  }
  
  // Ensure sequence numbers are numbers (not strings)
  if (safe.sequenceNo && typeof safe.sequenceNo === 'string') {
    safe.sequenceNo = parseInt(safe.sequenceNo, 10);
  }
  if (safe.operationStep && typeof safe.operationStep === 'string') {
    safe.operationStep = parseInt(safe.operationStep, 10);
  }
  if (safe.attempt && typeof safe.attempt === 'string') {
    safe.attempt = parseInt(safe.attempt, 10);
  }
  
  return safe;
}
