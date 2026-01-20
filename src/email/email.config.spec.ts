/**
 * Email Config Service Tests
 */

import { EmailConfigService } from './email.config';

describe('EmailConfigService', () => {
  let service: EmailConfigService;

  describe('with valid configuration', () => {
    beforeEach(() => {
      // Configurar process.env para los tests
      process.env.RESEND_API_KEY = 'test-api-key-123';
      process.env.EMAIL_FROM = 'noreply@firstplug.com';
      process.env.EMAIL_FROM_NAME = 'FirstPlug';
      delete process.env.EMAIL_TEST_RECIPIENT;

      service = new EmailConfigService();
    });

    afterEach(() => {
      // Limpiar variables de entorno después de cada test
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM_NAME;
      delete process.env.EMAIL_TEST_RECIPIENT;
    });

    it('should load configuration successfully', () => {
      const config = service.getResendConfig();

      expect(config.apiKey).toBe('test-api-key-123');
      expect(config.fromEmail).toBe('noreply@firstplug.com');
      expect(config.fromName).toBe('FirstPlug');
    });

    it('should return undefined for test recipient when not configured', () => {
      expect(service.getTestRecipient()).toBeUndefined();
    });

    it('should return false for isTestMode when test recipient not configured', () => {
      expect(service.isTestMode()).toBe(false);
    });
  });

  describe('with test mode enabled', () => {
    beforeEach(() => {
      // Configurar process.env con test recipient
      process.env.RESEND_API_KEY = 'test-api-key-123';
      process.env.EMAIL_FROM = 'noreply@firstplug.com';
      process.env.EMAIL_FROM_NAME = 'FirstPlug';
      process.env.EMAIL_TEST_RECIPIENT = 'test@example.com';

      service = new EmailConfigService();
    });

    afterEach(() => {
      // Limpiar variables de entorno después de cada test
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM_NAME;
      delete process.env.EMAIL_TEST_RECIPIENT;
    });

    it('should return test recipient when configured', () => {
      expect(service.getTestRecipient()).toBe('test@example.com');
    });

    it('should return true for isTestMode when test recipient configured', () => {
      expect(service.isTestMode()).toBe(true);
    });
  });

  describe('with invalid configuration', () => {
    it('should allow empty RESEND_API_KEY in development', () => {
      process.env.RESEND_API_KEY = '';
      process.env.EMAIL_FROM = 'noreply@firstplug.com';
      process.env.EMAIL_FROM_NAME = 'FirstPlug';

      service = new EmailConfigService();
      const config = service.getResendConfig();

      expect(config.apiKey).toBe('');
    });

    it('should throw error when EMAIL_FROM is invalid', () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.EMAIL_FROM = 'invalid-email';
      process.env.EMAIL_FROM_NAME = 'FirstPlug';

      expect(() => {
        new EmailConfigService();
      }).toThrow();
    });

    afterEach(() => {
      // Limpiar variables de entorno después de cada test
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM_NAME;
      delete process.env.EMAIL_TEST_RECIPIENT;
    });
  });
});
