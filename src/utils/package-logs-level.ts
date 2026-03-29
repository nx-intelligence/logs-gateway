/**
 * Package-level log threshold via `<packagePrefix>_LOGS_LEVEL` (canonical contract).
 * See docs/package-usage.md in this package.
 */

import type { LogLevel } from '../types';

const OFF_SYNONYMS = new Set(['off', 'none', 'silent']);

const LEVEL_ALIASES: Record<string, LogLevel> = {
  verbose: 'verbose',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error'
};

/**
 * Environment variable name for the canonical package log threshold: `<PREFIX>_LOGS_LEVEL`.
 */
export function packageLogsLevelEnvKey(envPrefix: string): string {
  return `${envPrefix}_LOGS_LEVEL`;
}

/**
 * Legacy env var: `<PREFIX>_LOG_LEVEL` (still supported when `_LOGS_LEVEL` is unset).
 */
export function legacyPackageLogLevelEnvKey(envPrefix: string): string {
  return `${envPrefix}_LOG_LEVEL`;
}

/**
 * Parse a single value (case-insensitive). Unknown values are treated as disabled (off).
 * Empty or whitespace-only string is treated as off.
 */
export function parsePackageLogsLevelString(raw: string | undefined): {
  packageLogsDisabled: boolean;
  logLevel?: LogLevel;
} {
  if (raw === undefined) {
    return { packageLogsDisabled: true };
  }
  const n = raw.trim().toLowerCase();
  if (n.length === 0 || OFF_SYNONYMS.has(n)) {
    return { packageLogsDisabled: true };
  }
  const level = LEVEL_ALIASES[n];
  if (level) {
    return { packageLogsDisabled: false, logLevel: level };
  }
  return { packageLogsDisabled: true };
}

export interface ResolvePackageLogsLevelOptions {
  envPrefix: string;
  /** Programmatic override — wins over environment. */
  userLogLevel?: LogLevel;
  /** For tests; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve package log threshold for a logger instance.
 *
 * Precedence: `userLogLevel` → `<PREFIX>_LOGS_LEVEL` (if set in env) → `<PREFIX>_LOG_LEVEL` (legacy, if set) → **`warn`** (neither key set in env).
 *
 * When silent, `logLevel` in the result is `'error'` as a placeholder for internal storage; emission is gated by `packageLogsDisabled`.
 */
export function resolvePackageLogsLevel(
  options: ResolvePackageLogsLevelOptions
): { packageLogsDisabled: boolean; logLevel: LogLevel } {
  const { envPrefix, userLogLevel, env = process.env } = options;

  if (userLogLevel !== undefined) {
    return { packageLogsDisabled: false, logLevel: userLogLevel };
  }

  const logsKey = packageLogsLevelEnvKey(envPrefix);
  const legacyKey = legacyPackageLogLevelEnvKey(envPrefix);

  if (Object.prototype.hasOwnProperty.call(env, logsKey)) {
    const parsed = parsePackageLogsLevelString(env[logsKey]);
    if (parsed.packageLogsDisabled || !parsed.logLevel) {
      return { packageLogsDisabled: true, logLevel: 'error' };
    }
    return { packageLogsDisabled: false, logLevel: parsed.logLevel };
  }

  if (Object.prototype.hasOwnProperty.call(env, legacyKey)) {
    const parsed = parsePackageLogsLevelString(env[legacyKey]);
    if (parsed.packageLogsDisabled || !parsed.logLevel) {
      return { packageLogsDisabled: true, logLevel: 'error' };
    }
    return { packageLogsDisabled: false, logLevel: parsed.logLevel };
  }

  return { packageLogsDisabled: false, logLevel: 'warn' };
}
