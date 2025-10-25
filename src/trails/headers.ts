/**
 * Header injection and extraction for trails context
 */

import type { ThreadContext, OperationCtx } from '../types';

/**
 * Inject thread context into HTTP headers
 */
export function injectThreadHeaders(
  headers: Record<string, string>, 
  context: ThreadContext
): void {
  headers['x-thread-id'] = context.threadId;
  headers['x-event-id'] = context.eventId;
  headers['x-seq-no'] = context.sequenceNo.toString();

  if (context.causationId) {
    const causationStr = Array.isArray(context.causationId) 
      ? context.causationId.join(',')
      : context.causationId;
    headers['x-causation-id'] = causationStr;
  }

  if (context.partitionKey) {
    headers['x-partition-key'] = context.partitionKey;
  }

  if (context.attempt !== undefined) {
    headers['x-attempt'] = context.attempt.toString();
  }

  if (context.shardId) {
    headers['x-shard-id'] = context.shardId;
  }

  if (context.workerId) {
    headers['x-worker-id'] = context.workerId;
  }
}

/**
 * Extract thread context from HTTP headers
 */
export function extractThreadHeaders(
  headers: Record<string, string>
): Partial<ThreadContext> {
  const context: Partial<ThreadContext> = {};

  if (headers['x-thread-id']) {
    context.threadId = headers['x-thread-id'];
  }

  if (headers['x-event-id']) {
    context.eventId = headers['x-event-id'];
  }

  if (headers['x-seq-no']) {
    const seqNo = parseInt(headers['x-seq-no'], 10);
    if (!isNaN(seqNo)) {
      context.sequenceNo = seqNo;
    }
  }

  if (headers['x-causation-id']) {
    const causationStr = headers['x-causation-id'];
    context.causationId = causationStr.includes(',') 
      ? causationStr.split(',')
      : causationStr;
  }

  if (headers['x-partition-key']) {
    context.partitionKey = headers['x-partition-key'];
  }

  if (headers['x-attempt']) {
    const attempt = parseInt(headers['x-attempt'], 10);
    if (!isNaN(attempt)) {
      context.attempt = attempt;
    }
  }

  if (headers['x-shard-id']) {
    context.shardId = headers['x-shard-id'];
  }

  if (headers['x-worker-id']) {
    context.workerId = headers['x-worker-id'];
  }

  return context;
}

/**
 * Inject operation context into HTTP headers
 */
export function injectOperationHeaders(
  headers: Record<string, string>, 
  context: OperationCtx
): void {
  headers['x-operation-id'] = context.operationId;
  headers['x-operation-name'] = context.operationName;
  headers['x-operation-path'] = context.operationPath;
  headers['x-operation-step'] = context.operationStep.toString();
  headers['x-trace-id'] = context.traceId;
  headers['x-span-id'] = context.spanId;

  if (context.parentOperationId) {
    headers['x-parent-operation-id'] = context.parentOperationId;
  }
}

/**
 * Extract operation context from HTTP headers
 */
export function extractOperationHeaders(
  headers: Record<string, string>
): Partial<OperationCtx> {
  const context: Partial<OperationCtx> = {};

  if (headers['x-operation-id']) {
    context.operationId = headers['x-operation-id'];
  }

  if (headers['x-parent-operation-id']) {
    context.parentOperationId = headers['x-parent-operation-id'];
  }

  if (headers['x-operation-name']) {
    context.operationName = headers['x-operation-name'];
  }

  if (headers['x-operation-path']) {
    context.operationPath = headers['x-operation-path'];
  }

  if (headers['x-operation-step']) {
    const step = parseInt(headers['x-operation-step'], 10);
    if (!isNaN(step)) {
      context.operationStep = step;
    }
  }

  if (headers['x-trace-id']) {
    context.traceId = headers['x-trace-id'];
  }

  if (headers['x-span-id']) {
    context.spanId = headers['x-span-id'];
  }

  return context;
}
