/**
 * Tests for fast-redact based sanitization
 */

import { describe, it, expect } from 'vitest';
import { LogSanitizer } from './sanitizer';
import type { SanitizationConfig } from './types';

describe('LogSanitizer with Fast-Redact', () => {
  const defaultConfig: SanitizationConfig = {
    enabled: true,
    maskWith: '[REDACTED]',
    partialMaskRatio: 1.0,
    maxDepth: 5,
    keysDenylist: ['password', 'secret', 'token', 'authorization'],
    keysAllowlist: [],
    fieldsHashInsteadOfMask: ['userid'],
    detectEmails: true,
    detectIPs: true,
    detectPhoneNumbers: true,
    detectJWTs: true,
    detectAPIKeys: true,
    detectAWSCreds: true,
    detectAzureKeys: true,
    detectGCPKeys: true,
    detectPasswords: true,
    detectCreditCards: true
  };

  describe('Key-based Redaction', () => {
    it('should redact keys from denylist', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('User login', {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        email: 'john@example.com'
      });

      expect(result.sanitized.data.password).toBe('[REDACTED]');
      expect(result.sanitized.data.token).toBe('[REDACTED]');
      expect(result.sanitized.data.username).toBe('john');
      expect(result.sanitized.data.email).toBe('[REDACTED]'); // Email is redacted by pattern detection
    });

    it('should handle nested key paths', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        keysDenylist: ['user.password', 'config.secret', '*.token']
      });

      const result = sanitizer.sanitize('Nested data', {
        user: {
          name: 'john',
          password: 'secret123'
        },
        config: {
          secret: 'config-secret'
        },
        api: {
          token: 'api-token'
        }
      });

      expect(result.sanitized.data.user.password).toBe('[REDACTED]');
      expect(result.sanitized.data.config.secret).toBe('[REDACTED]');
      expect(result.sanitized.data.api.token).toBe('[REDACTED]');
      expect(result.sanitized.data.user.name).toBe('john');
    });

    it('should respect allowlist over denylist', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        keysDenylist: ['password', 'secret'],
        keysAllowlist: ['user.password'] // Allow this specific path
      });

      const result = sanitizer.sanitize('Allowlist test', {
        password: 'should-be-redacted',
        user: {
          password: 'should-be-kept'
        }
      });

      expect(result.sanitized.data.password).toBe('[REDACTED]');
      expect(result.sanitized.data.user.password).toBe('should-be-kept');
    });

    it('should hash instead of mask for specified fields', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        fieldsHashInsteadOfMask: ['userid', 'sessionid']
      });

      const result = sanitizer.sanitize('Hash test', {
        userid: 'user123',
        sessionid: 'session456',
        password: 'secret123'
      });

      expect(result.sanitized.data.password).toBe('[REDACTED]');
      expect(result.sanitized.data.userid).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
      expect(result.sanitized.data.sessionid).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect and mask emails', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('Contact user@example.com for details', {
        email: 'admin@company.com'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.email).toBe('[REDACTED]');
    });

    it('should detect and mask IP addresses', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('Request from 192.168.1.1', {
        ip: '10.0.0.1',
        ipv6: '2001:db8::1'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.ip).toBe('[REDACTED]');
      expect(result.sanitized.data.ipv6).toBe('[REDACTED]');
    });

    it('should detect and mask phone numbers', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('Call +1-555-123-4567', {
        phone: '+44 20 7946 0958'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.phone).toBe('[REDACTED]');
    });

    it('should detect and mask JWTs', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const result = sanitizer.sanitize(`Token: ${jwt}`, {
        accessToken: jwt
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.accessToken).toBe('[REDACTED]');
    });

    it('should detect and mask API keys', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('API key: sk-1234567890abcdef', {
        apiKey: 'ak_abcdef1234567890'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.apiKey).toBe('[REDACTED]');
    });

    it('should detect and mask AWS credentials', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('AWS key: AKIAIOSFODNN7EXAMPLE', {
        awsKey: 'AKIAIOSFODNN7EXAMPLE'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.awsKey).toBe('[REDACTED]');
    });

    it('should detect and mask credit cards', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('Card: 4111 1111 1111 1111', {
        cardNumber: '5555 5555 5555 4444'
      });

      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.sanitized.data.cardNumber).toBe('[REDACTED]');
    });
  });

  describe('Performance Guardrails', () => {
    it('should respect maxDepth limit', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        maxDepth: 2
      });

      const deepObject = {
        level1: {
          level2: {
            level3: {
              password: 'secret'
            }
          }
        }
      };

      const result = sanitizer.sanitize('Deep object', deepObject);
      
      // Should not redact password at level 3 due to depth limit
      expect(result.sanitized.data.level1.level2.level3.password).toBe('secret');
      expect(result.sanitized.data._sanitization?.truncated).toBe(true);
    });

    it('should handle large strings efficiently', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const largeString = 'a'.repeat(10000) + 'user@example.com' + 'b'.repeat(10000);
      
      const result = sanitizer.sanitize(largeString, {});
      
      expect(result.sanitized.message).toContain('[REDACTED]');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should track redaction counts', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      const result = sanitizer.sanitize('Email: user@example.com', {
        password: 'secret',
        token: 'abc123',
        email: 'admin@company.com'
      });

      expect(result.redactionCount).toBeGreaterThan(0);
      expect(result.sanitized.data._sanitization?.redactionCount).toBe(result.redactionCount);
    });
  });

  describe('Configuration Options', () => {
    it('should disable sanitization when disabled', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        enabled: false
      });

      const result = sanitizer.sanitize('Email: user@example.com', {
        password: 'secret123'
      });

      expect(result.sanitized.message).toBe('Email: user@example.com');
      expect(result.sanitized.data.password).toBe('secret123');
      expect(result.redactionCount).toBe(0);
    });

    it('should use custom mask string', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        maskWith: '[MASKED]'
      });

      const result = sanitizer.sanitize('Email: user@example.com', {
        password: 'secret123'
      });

      expect(result.sanitized.message).toContain('[MASKED]');
      expect(result.sanitized.data.password).toBe('[MASKED]');
    });

    it('should support partial masking', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        partialMaskRatio: 0.5,
        maskWith: '***'
      });

      const result = sanitizer.sanitize('Email: user@example.com', {
        password: 'secret123'
      });

      expect(result.sanitized.data.password).toMatch(/^\*{3,}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle sanitization errors gracefully', () => {
      const sanitizer = new LogSanitizer(defaultConfig);
      
      // Test with circular reference
      const circular: any = { name: 'test' };
      circular.self = circular;

      const result = sanitizer.sanitize('Circular reference', circular);
      
      expect(result.sanitized.data._sanitization?.sanitizationError).toBe(true);
      expect(result.redactionCount).toBe(0);
    });

    it('should handle invalid configuration', () => {
      const sanitizer = new LogSanitizer({
        ...defaultConfig,
        maxDepth: -1
      });

      const result = sanitizer.sanitize('Test', { password: 'secret' });
      
      expect(result.sanitized.data.password).toBe('[REDACTED]');
    });
  });
});
