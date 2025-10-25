/**
 * AsyncLocalStorage-based trails module for operation and thread tracking
 */

import { AsyncLocalStorage } from 'async_hooks';
import { nanoid } from 'nanoid';
import type { OperationCtx, ThreadContext } from '../types';

// AsyncLocalStorage stores for context preservation
const operationStore = new AsyncLocalStorage<OperationCtx>();
const threadStore = new AsyncLocalStorage<ThreadContext>();

/**
 * Operation scope for managing operation lifecycle
 */
export class OperationScope {
  private readonly operationId: string;
  private readonly parentOperationId?: string | undefined;
  private readonly operationName: string;
  private readonly operationPath: string;
  private readonly operationStep: number;
  private readonly traceId: string;
  private readonly spanId: string;
  private ended = false;

  constructor(
    operationId: string,
    parentOperationId: string | undefined,
    operationName: string,
    operationPath: string,
    operationStep: number,
    traceId: string,
    spanId: string
  ) {
    this.operationId = operationId;
    this.parentOperationId = parentOperationId || undefined;
    this.operationName = operationName;
    this.operationPath = operationPath;
    this.operationStep = operationStep;
    this.traceId = traceId;
    this.spanId = spanId;
  }

  /**
   * End the operation scope
   */
  end(_resultAttrs?: Record<string, any>): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    
    // Clear the operation context by setting it to null
    operationStore.enterWith(null as any);
  }

  /**
   * Execute a function within this operation scope
   */
  async with<T>(fn: () => T | Promise<T>): Promise<T> {
    const context: OperationCtx = {
      operationId: this.operationId,
      parentOperationId: this.parentOperationId,
      operationName: this.operationName,
      operationPath: this.operationPath,
      operationStep: this.operationStep,
      traceId: this.traceId,
      spanId: this.spanId
    };

    return operationStore.run(context, fn);
  }
}

/**
 * Start a new operation scope
 */
export function startOperation(
  name: string, 
  _attrs?: Record<string, any>
): OperationScope {
  const parentCtx = getCurrentOperation();
  const operationId = nanoid(12);
  const traceId = parentCtx?.traceId || nanoid(16);
  const spanId = nanoid(12);
  
  const operationPath = parentCtx 
    ? `${parentCtx.operationPath}.${name}`
    : name;
  
  const operationStep = 0; // Root operations start at step 0

  const scope = new OperationScope(
    operationId,
    parentCtx?.operationId,
    name,
    operationPath,
    operationStep,
    traceId,
    spanId
  );

  // Set the context immediately
  const context: OperationCtx = {
    operationId,
    parentOperationId: parentCtx?.operationId,
    operationName: name,
    operationPath,
    operationStep,
    traceId,
    spanId
  };

  operationStore.enterWith(context);
  return scope;
}

/**
 * Create a child operation scope
 */
export function childOperation(
  name: string, 
  _attrs?: Record<string, any>
): OperationScope {
  const parentCtx = getCurrentOperation();
  if (!parentCtx) {
    throw new Error('No parent operation context available. Call startOperation() first.');
  }

  const operationId = nanoid(12);
  const traceId = parentCtx.traceId;
  const spanId = nanoid(12);
  
  const operationPath = `${parentCtx.operationPath}.${name}`;
  const operationStep = parentCtx.operationStep + 1;

  const scope = new OperationScope(
    operationId,
    parentCtx.operationId,
    name,
    operationPath,
    operationStep,
    traceId,
    spanId
  );

  // Set the context immediately
  const context: OperationCtx = {
    operationId,
    parentOperationId: parentCtx.operationId,
    operationName: name,
    operationPath,
    operationStep,
    traceId,
    spanId
  };

  operationStore.enterWith(context);
  return scope;
}

/**
 * Get the current operation context
 */
export function getCurrentOperation(): OperationCtx | null {
  return operationStore.getStore() || null;
}

/**
 * Create a new thread context
 */
export function newThread(init?: Partial<ThreadContext>): ThreadContext {
  const threadId = init?.threadId || nanoid(12);
  const eventId = nanoid(12);
  const sequenceNo = init?.sequenceNo || 0;

  const context: ThreadContext = {
    threadId,
    eventId,
    causationId: init?.causationId,
    sequenceNo,
    partitionKey: init?.partitionKey,
    attempt: init?.attempt,
    shardId: init?.shardId,
    workerId: init?.workerId
  };

  threadStore.enterWith(context);
  return context;
}

/**
 * Continue an existing thread context
 */
export function continueThread(ctx: Partial<ThreadContext>): ThreadContext {
  const currentThread = getCurrentThread();
  const threadId = ctx.threadId || currentThread?.threadId || nanoid(12);
  const eventId = nanoid(12);
  const sequenceNo = ctx.sequenceNo ?? (currentThread?.sequenceNo ?? 0);

  const context: ThreadContext = {
    threadId,
    eventId,
    causationId: ctx.causationId || currentThread?.causationId,
    sequenceNo,
    partitionKey: ctx.partitionKey || currentThread?.partitionKey,
    attempt: ctx.attempt || currentThread?.attempt,
    shardId: ctx.shardId || currentThread?.shardId,
    workerId: ctx.workerId || currentThread?.workerId
  };

  threadStore.enterWith(context);
  return context;
}

/**
 * Generate the next event ID and increment sequence
 */
export function nextEventId(): string {
  const currentThread = getCurrentThread();
  if (!currentThread) {
    throw new Error('No thread context available. Call newThread() or continueThread() first.');
  }

  const eventId = `evt_${nanoid(12)}`;
  const newSequenceNo = currentThread.sequenceNo + 1;
  
  // Update the current thread context with new event and sequence
  const updatedContext: ThreadContext = {
    ...currentThread,
    eventId,
    sequenceNo: newSequenceNo,
    causationId: currentThread.eventId 
      ? [...(Array.isArray(currentThread.causationId) ? currentThread.causationId : (currentThread.causationId ? [currentThread.causationId] : [])), currentThread.eventId]
      : currentThread.causationId
  };

  threadStore.enterWith(updatedContext);
  return eventId;
}

/**
 * Get the current thread context
 */
export function getCurrentThread(): ThreadContext | null {
  return threadStore.getStore() || null;
}

/**
 * Clear all contexts (for testing)
 */
export function clearAllContexts(): void {
  operationStore.enterWith(null as any);
  threadStore.enterWith(null as any);
}
