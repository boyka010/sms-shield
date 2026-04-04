import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateEgyptianPhone,
  normalizeEgyptianPhone,
  hashPhoneNumber,
  hashEmail,
  encryptApiKey,
  decryptApiKey,
  verifyHmacSignature,
  verifyWebhookSignature,
  maskPhoneNumber
} from '../app/utils/security.server';

describe('Security Utilities', () => {
  describe('validateEgyptianPhone', () => {
    it('should validate correct Egyptian phone numbers', () => {
      expect(validateEgyptianPhone('01012345678')).toBe(true);
      expect(validateEgyptianPhone('01112345678')).toBe(true);
      expect(validateEgyptianPhone('01212345678')).toBe(true);
      expect(validateEgyptianPhone('01512345678')).toBe(true);
      expect(validateEgyptianPhone('+201012345678')).toBe(true);
      expect(validateEgyptianPhone('+20 101 234 5678')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validateEgyptianPhone('0151234567')).toBe(false);
      expect(validateEgyptianPhone('010123456')).toBe(false);
      expect(validateEgyptianPhone('+2491012345678')).toBe(false);
      expect(validateEgyptianPhone('abc')).toBe(false);
      expect(validateEgyptianPhone('')).toBe(false);
    });
  });

  describe('normalizeEgyptianPhone', () => {
    it('should normalize phone numbers to +20 format', () => {
      expect(normalizeEgyptianPhone('01012345678')).toBe('201012345678');
      expect(normalizeEgyptianPhone('01112345678')).toBe('201112345678');
      expect(normalizeEgyptianPhone('+201012345678')).toBe('201012345678');
      expect(normalizeEgyptianPhone('+20 101 234 5678')).toBe('201012345678');
    });
  });

  describe('hashPhoneNumber', () => {
    it('should return consistent SHA-256 hash', () => {
      const hash1 = hashPhoneNumber('01012345678');
      const hash2 = hashPhoneNumber('01012345678');
      const hash3 = hashPhoneNumber('01112345678');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });

    it('should normalize phone before hashing', () => {
      const hash1 = hashPhoneNumber('01012345678');
      const hash2 = hashPhoneNumber('+201012345678');

      expect(hash1).toBe(hash2);
    });
  });

  describe('hashEmail', () => {
    it('should hash email consistently', () => {
      const hash1 = hashEmail('Test@Example.com');
      const hash2 = hashEmail('test@example.com');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('encryptApiKey / decryptApiKey', () => {
    const masterKey = 'test-master-key-32-characters!';

    it('should encrypt and decrypt API key correctly', () => {
      const apiKey = 'secret-api-key-12345';
      const encrypted = encryptApiKey(apiKey, masterKey);
      const decrypted = decryptApiKey(encrypted, masterKey);

      expect(decrypted).toBe(apiKey);
      expect(encrypted).not.toBe(apiKey);
    });

    it('should produce different ciphertext for same input', () => {
      const apiKey = 'secret-api-key-12345';
      const encrypted1 = encryptApiKey(apiKey, masterKey);
      const encrypted2 = encryptApiKey(apiKey, masterKey);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('verifyHmacSignature', () => {
    it('should verify valid HMAC signature', () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ test: 'data' });
      const crypto = require('crypto');
      
      const hmac = crypto.createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      expect(verifyHmacSignature(payload, hmac, secret)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      expect(verifyHmacSignature('payload', 'invalid', 'secret')).toBe(false);
      expect(verifyHmacSignature('payload', '', 'secret')).toBe(false);
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask phone number correctly', () => {
      expect(maskPhoneNumber('01012345678')).toBe('***345678');
      expect(maskPhoneNumber('+201012345678')).toBe('***345678');
    });
  });
});
