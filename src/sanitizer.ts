/**
 * logs-gateway - PII/Credentials Sanitizer
 * 
 * This file contains the sanitization logic for detecting and masking sensitive data.
 * Uses established npm packages for robust PII detection and sanitization.
 */

import * as crypto from 'crypto';
// import fastRedact from 'fast-redact'; // Disabled for now
import { sanitizePii } from '@cdssnc/sanitize-pii';
import * as validator from 'validator';
import { filterXSS } from 'xss';
import { SanitizationConfig } from './types';

/**
 * Sanitization result with metadata about what was sanitized
 */
export interface SanitizationResult {
  sanitized: any;
  redactionCount: number;
  truncated: boolean;
}

/**
 * Main sanitizer class for detecting and masking PII/credentials
 */
export class LogSanitizer {
  private config: Required<SanitizationConfig>;
  // private redactor: any; // Currently not used

  constructor(config: SanitizationConfig) {
    this.config = {
      enabled: false,
      detectEmails: true,
      detectIPs: true,
      detectPhoneNumbers: true,
      detectJWTs: true,
      detectAPIKeys: true,
      detectAWSCreds: true,
      detectAzureKeys: true,
      detectGCPKeys: true,
      detectPasswords: true,
      detectCreditCards: true,
      maskWith: '[REDACTED]',
      partialMaskRatio: 1.0,
      maxDepth: 5,
      keysDenylist: ['authorization', 'token', 'secret', 'api_key', 'passwd', 'password'],
      keysAllowlist: [],
      fieldsHashInsteadOfMask: [],
      ...config
    };

    // Validate maxDepth after config merge
    this.config.maxDepth = Math.max(1, this.config.maxDepth);

    // Initialize fast-redact for key-based redaction
    // this.initializeRedactor(); // Disabled for now
  }

  /**
   * Initialize fast-redact with configuration
   */
  // private initializeRedactor(): void {
  //   if (!this.config.enabled) {
  //     return;
  //   }

  //   // Build paths from denylist, supporting nested keys
  //   const paths = this.config.keysDenylist.filter(key => !key.includes('*')); // Only use exact paths for now

  //   this.redactor = fastRedact({
  //     paths,
  //     censor: this.config.maskWith,
  //     serialize: false
  //   });
  // }

  /**
   * Sanitize a log entry's message and metadata
   */
  sanitize(message: string, meta?: any): SanitizationResult {
    if (!this.config.enabled) {
      return {
        sanitized: { message, data: meta },
        redactionCount: 0,
        truncated: false
      };
    }

    const startTime = Date.now();
    const maxTime = 100; // 100ms budget

    let redactionCount = 0;
    let truncated = false;

    try {
      // Sanitize message using pattern detection
      const messageResult = this.sanitizeString(message, () => {
        if (Date.now() - startTime > maxTime) {
          truncated = true;
          return message;
        }
        return this.detectAndMask(message);
      });

      const sanitizedMessage = messageResult.sanitized;
      redactionCount += messageResult.redactionCount;

      // Sanitize metadata using fast-redact for key-based redaction
      let sanitizedMeta = meta;
      if (meta && typeof meta === 'object') {
        // Apply manual sanitization with key-based rules and hashing
        const result = this.sanitizeObject(meta, 0, startTime, maxTime, new WeakSet());
        sanitizedMeta = result.sanitized;
        redactionCount += result.redactionCount;
        truncated = truncated || result.truncated;
      }

      // Add sanitization metadata
      if (sanitizedMeta && typeof sanitizedMeta === 'object') {
        sanitizedMeta._sanitization = {
          redactionCount,
          truncated
        };
      }

      return {
        sanitized: { message: sanitizedMessage, data: sanitizedMeta },
        redactionCount,
        truncated
      };
    } catch (error) {
      // Handle sanitization errors gracefully
      return {
        sanitized: { 
          message: this.config.maskWith, 
          data: { 
            _sanitization: { 
              sanitizationError: true,
              redactionCount: 0,
              truncated: true
            }
          }
        },
        redactionCount: 0,
        truncated: true
      };
    }
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: any, depth: number, startTime: number, maxTime: number, seen = new WeakSet()): SanitizationResult {
    if (depth > this.config.maxDepth) {
      return { sanitized: obj, redactionCount: 0, truncated: true };
    }

    if (Date.now() - startTime > maxTime) {
      return { sanitized: this.config.maskWith, redactionCount: 1, truncated: true };
    }

    if (obj === null || obj === undefined) {
      return { sanitized: obj, redactionCount: 0, truncated: false };
    }

    // Check for circular references
    if (typeof obj === 'object' && seen.has(obj)) {
      throw new Error('Circular reference detected');
    }

    // Add object to seen set for circular reference detection
    if (typeof obj === 'object') {
      seen.add(obj);
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, () => this.detectAndMask(obj));
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return { sanitized: obj, redactionCount: 0, truncated: false };
    }

    if (Array.isArray(obj)) {
      const sanitizedArray: any[] = [];
      let totalRedactions = 0;
      let truncated = false;

              for (const item of obj) {
                const result = this.sanitizeObject(item, depth + 1, startTime, maxTime, seen);
                sanitizedArray.push(result.sanitized);
                totalRedactions += result.redactionCount;
                truncated = truncated || result.truncated;
              }

      return { sanitized: sanitizedArray, redactionCount: totalRedactions, truncated };
    }

    if (typeof obj === 'object') {
      const sanitizedObj: any = {};
      let totalRedactions = 0;
      let truncated = false;

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check allowlist first (highest priority)
        // Check for exact key match or nested key match
        const isInAllowlist = this.config.keysAllowlist.some(allowKey => {
          if (allowKey.includes('.')) {
            // For nested keys like 'user.password', we need to check the full path
            // This is a simplified check - in a real implementation, we'd need to track the full path
            return false; // For now, only exact matches work
          }
          return allowKey === lowerKey;
        });
        
        if (isInAllowlist) {
          sanitizedObj[key] = value;
          continue;
        }

        // Check if this key should be hashed instead of masked
        if (this.config.fieldsHashInsteadOfMask.includes(lowerKey)) {
          if (typeof value === 'string') {
            sanitizedObj[key] = this.hashValue(value);
            totalRedactions++;
          } else {
            sanitizedObj[key] = value;
          }
          continue;
        }

        // Check if this key should be redacted (including nested paths)
        const shouldRedact = this.config.keysDenylist.some(denyKey => {
          if (denyKey.includes('.')) {
            // For nested keys like 'user.password', we need to check the full path
            // This is a simplified check - in a real implementation, we'd need to track the full path
            return false; // For now, only exact matches work
          }
          return denyKey === lowerKey;
        });
        
        if (shouldRedact) {
          sanitizedObj[key] = this.config.maskWith;
          totalRedactions++;
          continue;
        }

        // For other keys, only apply pattern detection to string values
        if (typeof value === 'string') {
          const sanitizedString = this.detectAndMask(value);
          sanitizedObj[key] = sanitizedString;
          if (sanitizedString !== value) {
            totalRedactions++;
          }
                } else {
                  // Recursively sanitize non-string values
                  const result = this.sanitizeObject(value, depth + 1, startTime, maxTime, seen);
                  sanitizedObj[key] = result.sanitized;
                  totalRedactions += result.redactionCount;
                  truncated = truncated || result.truncated;
                }
      }

      return { sanitized: sanitizedObj, redactionCount: totalRedactions, truncated };
    }

    return { sanitized: obj, redactionCount: 0, truncated: false };
  }

  /**
   * Sanitize a string value
   */
  private sanitizeString(str: string, detector: () => string): { sanitized: string; redactionCount: number; truncated: boolean } {
    const sanitized = detector();
    return {
      sanitized,
      redactionCount: sanitized !== str ? 1 : 0,
      truncated: false
    };
  }

  /**
   * Detect and mask sensitive patterns in a string using npm packages
   */
  public detectAndMask(str: string): string {
    let result = str;

    // Use @cdssnc/sanitize-pii for comprehensive PII detection
    if (this.config.detectEmails || this.config.detectIPs || this.config.detectPhoneNumbers) {
      try {
        result = sanitizePii(result, {
          replacementTemplate: this.config.maskWith,
          useDefaultPatterns: true
        });
      } catch (error) {
        // Fallback to custom patterns if the package fails
      }
      
      // Always apply custom patterns as fallback
      result = this.fallbackPatternDetection(result);
    }

    // Use validator for additional email validation
    if (this.config.detectEmails) {
      result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
        if (validator.isEmail(match)) {
          return this.config.maskWith;
        }
        return match;
      });
    }

    // Custom patterns for credentials and tokens
    result = this.detectCredentials(result);

    // XSS protection
    result = filterXSS(result, {
      whiteList: {}, // Remove all HTML tags
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });

    return result;
  }

  /**
   * Fallback pattern detection if npm packages fail
   */
  private fallbackPatternDetection(str: string): string {
    let result = str;

    // Email addresses
    if (this.config.detectEmails) {
      result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, this.config.maskWith);
    }

    // IP addresses (IPv4 and IPv6)
    if (this.config.detectIPs) {
      // IPv4 addresses
      result = result.replace(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, this.config.maskWith);
      
      // IPv6 addresses - comprehensive pattern
      result = result.replace(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, this.config.maskWith);
      // Simple pattern for any IPv6-like string with :: (most general, run first)
      result = result.replace(/[0-9a-fA-F]+:[0-9a-fA-F]+::[0-9a-fA-F]+/g, this.config.maskWith);
      result = result.replace(/\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b/g, this.config.maskWith);
      result = result.replace(/\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g, this.config.maskWith);
      result = result.replace(/\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b/g, this.config.maskWith);
    }

    // Phone numbers (basic patterns)
    if (this.config.detectPhoneNumbers) {
      // US phone numbers
      result = result.replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, this.config.maskWith);
      
      // International phone numbers with country codes
      result = result.replace(/\b\+[1-9]\d{1,3}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}\b/g, this.config.maskWith);
      // More flexible pattern for international numbers with spaces
      result = result.replace(/\b\+[1-9]\d{1,3}\s+\d{1,4}\s+\d{1,4}\s+\d{1,9}\b/g, this.config.maskWith);
      // Pattern without word boundaries for better matching
      result = result.replace(/\+[1-9]\d{1,3}\s+\d+\s+\d+\s+\d+/g, this.config.maskWith);
      
      // Generic phone number pattern
      result = result.replace(/\b\+?[1-9]\d{1,14}\b/g, (match) => {
        // More specific phone number validation
        if (match.length >= 10 && match.length <= 15) {
          return this.config.maskWith;
        }
        return match;
      });
    }

    return result;
  }

  /**
   * Detect credentials and API keys using custom patterns
   */
  public detectCredentials(str: string): string {
    let result = str;

    // JWTs
    if (this.config.detectJWTs) {
      result = result.replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g, this.config.maskWith);
    }

    // API keys (generic patterns)
    if (this.config.detectAPIKeys) {
      result = result.replace(/\b[A-Za-z0-9_-]{20,}\b/g, (match) => {
        // Skip if it looks like a normal word or number
        if (/^[0-9]+$/.test(match) || /^[A-Za-z]+$/.test(match)) {
          return match;
        }
        return this.config.maskWith;
      });
      // Specific API key patterns
      result = result.replace(/\bsk-[A-Za-z0-9]{10,}\b/g, this.config.maskWith);
      result = result.replace(/\bak_[A-Za-z0-9]{10,}\b/g, this.config.maskWith);
    }

    // AWS credentials
    if (this.config.detectAWSCreds) {
      result = result.replace(/\bAKIA[0-9A-Z]{16}\b/g, this.config.maskWith);
      result = result.replace(/\baws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}\b/g, this.config.maskWith);
    }

    // Azure keys
    if (this.config.detectAzureKeys) {
      result = result.replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, (match) => {
        // More specific Azure key patterns
        if (match.length >= 32 && match.length <= 44) {
          return this.config.maskWith;
        }
        return match;
      });
    }

    // GCP keys
    if (this.config.detectGCPKeys) {
      result = result.replace(/\b[A-Za-z0-9_-]{24,}\b/g, (match) => {
        // GCP service account keys are typically longer
        if (match.length >= 24) {
          return this.config.maskWith;
        }
        return match;
      });
    }

    // Password fields
    if (this.config.detectPasswords) {
      result = result.replace(/\b(?:password|pass|pwd)\s*[:=]\s*[^\s]+\b/gi, this.config.maskWith);
    }

    // Credit cards (Luhn algorithm)
    if (this.config.detectCreditCards) {
      result = result.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, (match) => {
        const digits = match.replace(/[-\s]/g, '');
        if (this.isValidCreditCard(digits)) {
          return this.config.maskWith;
        }
        return match;
      });
    }

    return result;
  }

  /**
   * Apply pattern detection to object values
   */
  private applyPatternDetectionToObject(obj: any, startTime: number, maxTime: number): any {
    if (Date.now() - startTime > maxTime) {
      return obj;
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.detectAndMask(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.applyPatternDetectionToObject(item, startTime, maxTime));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip sanitization metadata
        if (key === '_sanitization') {
          result[key] = value;
          continue;
        }

        // Apply hashing for specified fields
        if (this.config.fieldsHashInsteadOfMask.includes(key.toLowerCase()) && typeof value === 'string') {
          result[key] = this.hashValue(value);
          // redactionCount++; // This variable is not in scope here
        } else {
          result[key] = this.applyPatternDetectionToObject(value, startTime, maxTime);
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Hash a value using SHA-256
   */
  private hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  private isValidCreditCard(cardNumber: string): boolean {
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      const char = cardNumber[i];
      if (!char) continue;
      
      let digit = parseInt(char);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
}
