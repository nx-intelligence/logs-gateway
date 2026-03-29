import { describe, it, expect } from 'vitest';
import {
  parsePackageLogsLevelString,
  resolvePackageLogsLevel,
  packageLogsLevelEnvKey,
  legacyPackageLogLevelEnvKey
} from './package-logs-level';

describe('packageLogsLevelEnvKey', () => {
  it('builds canonical key', () => {
    expect(packageLogsLevelEnvKey('MY_LIB')).toBe('MY_LIB_LOGS_LEVEL');
  });
});

describe('legacyPackageLogLevelEnvKey', () => {
  it('builds legacy key', () => {
    expect(legacyPackageLogLevelEnvKey('MY_LIB')).toBe('MY_LIB_LOG_LEVEL');
  });
});

describe('parsePackageLogsLevelString', () => {
  it('treats undefined as off', () => {
    expect(parsePackageLogsLevelString(undefined)).toEqual({ packageLogsDisabled: true });
  });

  it('normalizes levels case-insensitively', () => {
    expect(parsePackageLogsLevelString('INFO')).toEqual({
      packageLogsDisabled: false,
      logLevel: 'info'
    });
    expect(parsePackageLogsLevelString('  Debug  ')).toEqual({
      packageLogsDisabled: false,
      logLevel: 'debug'
    });
  });

  it('treats off synonyms as disabled', () => {
    for (const v of ['off', 'none', 'silent', 'OFF']) {
      expect(parsePackageLogsLevelString(v)).toEqual({ packageLogsDisabled: true });
    }
  });

  it('treats unknown as disabled', () => {
    expect(parsePackageLogsLevelString('trace')).toEqual({ packageLogsDisabled: true });
  });
});

describe('resolvePackageLogsLevel', () => {
  it('prefers userLogLevel over env', () => {
    const env = { MY_LIB_LOGS_LEVEL: 'off' } as NodeJS.ProcessEnv;
    const r = resolvePackageLogsLevel({
      envPrefix: 'MY_LIB',
      userLogLevel: 'info',
      env
    });
    expect(r).toEqual({ packageLogsDisabled: false, logLevel: 'info' });
  });

  it('uses _LOGS_LEVEL when set', () => {
    const env = { MY_LIB_LOGS_LEVEL: 'warn' } as NodeJS.ProcessEnv;
    expect(
      resolvePackageLogsLevel({ envPrefix: 'MY_LIB', env })
    ).toEqual({ packageLogsDisabled: false, logLevel: 'warn' });
  });

  it('uses legacy _LOG_LEVEL when _LOGS_LEVEL is absent', () => {
    const env = { MY_LIB_LOG_LEVEL: 'debug' } as NodeJS.ProcessEnv;
    expect(
      resolvePackageLogsLevel({ envPrefix: 'MY_LIB', env })
    ).toEqual({ packageLogsDisabled: false, logLevel: 'debug' });
  });

  it('prefers _LOGS_LEVEL over _LOG_LEVEL when both present', () => {
    const env = {
      MY_LIB_LOGS_LEVEL: 'error',
      MY_LIB_LOG_LEVEL: 'verbose'
    } as NodeJS.ProcessEnv;
    expect(
      resolvePackageLogsLevel({ envPrefix: 'MY_LIB', env })
    ).toEqual({ packageLogsDisabled: false, logLevel: 'error' });
  });

  it('defaults to warn when both env keys are omitted', () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(
      resolvePackageLogsLevel({ envPrefix: 'MY_LIB', env })
    ).toEqual({ packageLogsDisabled: false, logLevel: 'warn' });
  });

  it('treats empty _LOGS_LEVEL as silent', () => {
    const env = { MY_LIB_LOGS_LEVEL: '' } as NodeJS.ProcessEnv;
    expect(
      resolvePackageLogsLevel({ envPrefix: 'MY_LIB', env })
    ).toEqual({ packageLogsDisabled: true, logLevel: 'error' });
  });
});
