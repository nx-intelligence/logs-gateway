/**
 * ERC 2.0 Manifest Generation Script
 * 
 * This script generates erc-manifest.json and .env.example for ERC 2.0 compliance.
 * Note: logs-gateway uses dynamic environment variable prefixes based on packageConfig.envPrefix.
 * This script generates documentation using a representative prefix (LOGS_GATEWAY).
 */

import { initConfig } from 'nx-config2';
import * as fs from 'fs';
import * as path from 'path';

// Representative prefix for documentation (users will replace with their own prefix)
const EXAMPLE_PREFIX = 'LOGS_GATEWAY';

const buildEnvVar = (suffix: string) => `${EXAMPLE_PREFIX}_${suffix}`;

// Build configuration map for ERC manifest generation
const configMap: any = {
  logToConsole: `ENV.${buildEnvVar('LOG_TO_CONSOLE')}||true`,
  logToFile: `ENV.${buildEnvVar('LOG_TO_FILE')}||false`,
  logFilePath: `ENV.${buildEnvVar('LOG_FILE')}||''`,
  logLevel: `ENV.${buildEnvVar('LOG_LEVEL')}||info`,
  logFormat: `ENV.${buildEnvVar('LOG_FORMAT')}||table`,
  showFullTimestamp: `ENV.${buildEnvVar('SHOW_FULL_TIMESTAMP')}||false`,
  consolePackagesShow: `ENV.${buildEnvVar('CONSOLE_PACKAGES_SHOW')}||''`,
  consolePackagesHide: `ENV.${buildEnvVar('CONSOLE_PACKAGES_HIDE')}||''`,
  enableUnifiedLogger: `ENV.${buildEnvVar('LOG_TO_UNIFIED')}||false`,
  defaultSource: `ENV.${buildEnvVar('LOG_DEFAULT_SOURCE')}||application`,
  sanitization: {
    enabled: `ENV.${buildEnvVar('SANITIZE_ENABLED')}||false`,
    maskWith: `ENV.${buildEnvVar('SANITIZE_MASK')}||[REDACTED]`,
    partialMaskRatio: `ENV.${buildEnvVar('SANITIZE_PARTIAL_RATIO')}:number||1.0`,
    maxDepth: `ENV.${buildEnvVar('SANITIZE_MAX_DEPTH')}:number||5`,
    keysDenylist: `ENV.${buildEnvVar('SANITIZE_KEYS_DENYLIST')}||authorization,token,secret,api_key,passwd,password`,
    keysAllowlist: `ENV.${buildEnvVar('SANITIZE_KEYS_ALLOWLIST')}||''`,
    fieldsHashInsteadOfMask: `ENV.${buildEnvVar('SANITIZE_FIELDS_HASH')}||''`,
    detectEmails: `ENV.${buildEnvVar('SANITIZE_DETECT_EMAILS')}||true`,
    detectIPs: `ENV.${buildEnvVar('SANITIZE_DETECT_IPS')}||true`,
    detectPhoneNumbers: `ENV.${buildEnvVar('SANITIZE_DETECT_PHONES')}||true`,
    detectJWTs: `ENV.${buildEnvVar('SANITIZE_DETECT_JWTS')}||true`,
    detectAPIKeys: `ENV.${buildEnvVar('SANITIZE_DETECT_APIKEYS')}||true`,
    detectAWSCreds: `ENV.${buildEnvVar('SANITIZE_DETECT_AWSCREDS')}||true`,
    detectAzureKeys: `ENV.${buildEnvVar('SANITIZE_DETECT_AZUREKEYS')}||true`,
    detectGCPKeys: `ENV.${buildEnvVar('SANITIZE_DETECT_GCPKEYS')}||true`,
    detectPasswords: `ENV.${buildEnvVar('SANITIZE_DETECT_PASSWORDS')}||true`,
    detectCreditCards: `ENV.${buildEnvVar('SANITIZE_DETECT_CREDITCARDS')}||true`
  },
  shadow: {
    enabled: `ENV.${buildEnvVar('SHADOW_ENABLED')}||false`,
    format: `ENV.${buildEnvVar('SHADOW_FORMAT')}||json`,
    directory: `ENV.${buildEnvVar('SHADOW_DIR')}||./logs/shadow`,
    ttlMs: `ENV.${buildEnvVar('SHADOW_TTL_MS')}:number||86400000`,
    respectRoutingBlocks: `ENV.${buildEnvVar('SHADOW_RESPECT_ROUTING')}||true`,
    rollingBuffer: {
      maxEntries: `ENV.${buildEnvVar('SHADOW_BUFFER_ENTRIES')}:number||0`,
      maxAgeMs: `ENV.${buildEnvVar('SHADOW_BUFFER_AGE_MS')}:number||0`
    }
  },
  // Unified logger dependencies (non-ERC, manually documented)
  unifiedLogger: {
    service: `ENV.${buildEnvVar('UNIFIED_LOGGER_SERVICE')}||logs-gateway`,
    env: `ENV.${buildEnvVar('UNIFIED_LOGGER_ENV')}||production`,
    level: `ENV.${buildEnvVar('UNIFIED_LOGGER_LEVEL')}||info`,
    transports: {
      console: `ENV.${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_CONSOLE')}||false`,
      papertrail: `ENV.${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_PAPERTRAIL')}||false`,
      udpRelay: `ENV.${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_UDP')}||false`
    }
  },
  // Papertrail (required by unified-logger when papertrail transport is enabled)
  papertrail: {
    host: `ENV.PAPERTRAIL_HOST||''`,
    port: `ENV.PAPERTRAIL_PORT:number||0`
  },
  // UDP Relay (required by unified-logger when udpRelay transport is enabled)
  udpRelay: {
    host: `ENV.UDP_RELAY_HOST||127.0.0.1`,
    port: `ENV.UDP_RELAY_PORT:number||0`
  }
};

// Generate ERC manifest and .env.example
const result = initConfig(configMap, {
  ercMode: true,
  componentName: 'logs-gateway',
  componentVersion: '1.5.0',
  ercDependencies: [], // No ERC-compliant dependencies
  generateManifest: true,
  generateEnvExample: true,
  throwOnMissing: false,
  descriptions: {
    // Core logging
    [`${buildEnvVar('LOG_TO_CONSOLE')}`]: 'Enable console output (default: true)',
    [`${buildEnvVar('LOG_TO_FILE')}`]: 'Enable file output (default: false)',
    [`${buildEnvVar('LOG_FILE')}`]: 'File path for logs (required if LOG_TO_FILE is true)',
    [`${buildEnvVar('LOG_LEVEL')}`]: 'Minimum log level: verbose|debug|info|warn|error (default: info)',
    [`${buildEnvVar('LOG_FORMAT')}`]: 'Output format: text|json|yaml|table (default: table)',
    [`${buildEnvVar('SHOW_FULL_TIMESTAMP')}`]: 'Show full ISO timestamp in console logs (default: false)',
    [`${buildEnvVar('CONSOLE_PACKAGES_SHOW')}`]: 'Comma-separated list of package names to show in console (console only, default: show all)',
    [`${buildEnvVar('CONSOLE_PACKAGES_HIDE')}`]: 'Comma-separated list of package names to hide in console (console only, default: show all)',
    [`${buildEnvVar('LOG_TO_UNIFIED')}`]: 'Enable unified-logger output (default: false)',
    [`${buildEnvVar('LOG_DEFAULT_SOURCE')}`]: 'Default source identifier for log entries (default: application)',
    // Sanitization
    [`${buildEnvVar('SANITIZE_ENABLED')}`]: 'Enable PII/credentials sanitization (default: false)',
    [`${buildEnvVar('SANITIZE_MASK')}`]: 'Mask string for redacted values (default: [REDACTED])',
    [`${buildEnvVar('SANITIZE_PARTIAL_RATIO')}`]: 'Partial mask ratio (0.0-1.0, default: 1.0 = full mask)',
    [`${buildEnvVar('SANITIZE_MAX_DEPTH')}`]: 'Maximum JSON scan depth for sanitization (default: 5)',
    [`${buildEnvVar('SANITIZE_KEYS_DENYLIST')}`]: 'Comma-separated list of keys to always mask (default: authorization,token,secret,api_key,passwd,password)',
    [`${buildEnvVar('SANITIZE_KEYS_ALLOWLIST')}`]: 'Comma-separated list of keys to skip masking',
    [`${buildEnvVar('SANITIZE_FIELDS_HASH')}`]: 'Comma-separated list of keys to hash instead of mask',
    [`${buildEnvVar('SANITIZE_DETECT_EMAILS')}`]: 'Enable email detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_IPS')}`]: 'Enable IP address detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_PHONES')}`]: 'Enable phone number detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_JWTS')}`]: 'Enable JWT token detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_APIKEYS')}`]: 'Enable API key detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_AWSCREDS')}`]: 'Enable AWS credentials detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_AZUREKEYS')}`]: 'Enable Azure key detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_GCPKEYS')}`]: 'Enable GCP key detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_PASSWORDS')}`]: 'Enable password detection (default: true)',
    [`${buildEnvVar('SANITIZE_DETECT_CREDITCARDS')}`]: 'Enable credit card detection (default: true)',
    // Shadow logging
    [`${buildEnvVar('SHADOW_ENABLED')}`]: 'Enable shadow logging for per-run capture (default: false)',
    [`${buildEnvVar('SHADOW_FORMAT')}`]: 'Shadow file format: json|yaml (default: json)',
    [`${buildEnvVar('SHADOW_DIR')}`]: 'Directory for shadow files (default: ./logs/shadow)',
    [`${buildEnvVar('SHADOW_TTL_MS')}`]: 'Time-to-live for shadow files in milliseconds (default: 86400000 = 1 day)',
    [`${buildEnvVar('SHADOW_RESPECT_ROUTING')}`]: 'Respect routing blockOutputs metadata (default: true)',
    [`${buildEnvVar('SHADOW_BUFFER_ENTRIES')}`]: 'Maximum entries in rolling buffer (default: 0 = disabled)',
    [`${buildEnvVar('SHADOW_BUFFER_AGE_MS')}`]: 'Maximum age of buffered entries in ms (default: 0 = disabled)',
    // Unified logger (non-ERC dependency)
    [`${buildEnvVar('UNIFIED_LOGGER_SERVICE')}`]: 'Service name for unified-logger (used by @x-developer/unified-logger)',
    [`${buildEnvVar('UNIFIED_LOGGER_ENV')}`]: 'Environment name for unified-logger (used by @x-developer/unified-logger)',
    [`${buildEnvVar('UNIFIED_LOGGER_LEVEL')}`]: 'Log level for unified-logger (used by @x-developer/unified-logger)',
    [`${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_CONSOLE')}`]: 'Enable console transport in unified-logger (used by @x-developer/unified-logger)',
    [`${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_PAPERTRAIL')}`]: 'Enable Papertrail transport in unified-logger (used by @x-developer/unified-logger)',
    [`${buildEnvVar('UNIFIED_LOGGER_TRANSPORT_UDP')}`]: 'Enable UDP relay transport in unified-logger (used by @x-developer/unified-logger)',
    // Papertrail (required by unified-logger when papertrail transport is enabled)
    'PAPERTRAIL_HOST': 'Papertrail host (required by @x-developer/unified-logger when papertrail transport is enabled)',
    'PAPERTRAIL_PORT': 'Papertrail port (required by @x-developer/unified-logger when papertrail transport is enabled)',
    // UDP Relay (required by unified-logger when udpRelay transport is enabled)
    'UDP_RELAY_HOST': 'UDP relay host (required by @x-developer/unified-logger when udpRelay transport is enabled, default: 127.0.0.1)',
    'UDP_RELAY_PORT': 'UDP relay port (required by @x-developer/unified-logger when udpRelay transport is enabled)'
  }
});

console.log('✅ ERC 2.0 manifest and .env.example generated successfully!');
console.log('📄 Files created:');
console.log('   - erc-manifest.json');
console.log('   - .env.example');
console.log('');
console.log('ℹ️  Note: Environment variables use dynamic prefixes based on packageConfig.envPrefix.');
console.log(`   This example uses prefix "${EXAMPLE_PREFIX}" - replace with your own prefix.`);

