/**
 * Email Service Tests
 */

import { BadRequestException } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigService } from './email.config';
import { EmailNotificationType } from './email.types';

// Mock de Resend
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: EmailConfigService;

  beforeEach(() => {
    // Configurar process.env para los tests
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'test@example.com';
    process.env.EMAIL_FROM_NAME = 'Test';
    delete process.env.EMAIL_TEST_RECIPIENT;

    // Crear instancias reales
    configService = new EmailConfigService();
    service = new EmailService(configService);

    // Limpiar mocks
    mockSend.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM_NAME;
    delete process.env.EMAIL_TEST_RECIPIENT;
  });

  describe('sendImmediate', () => {
    const validProps = {
      recipientName: 'John Doe',
      recipientEmail: 'john@example.com',
      tenantName: 'Test Tenant',
      type: EmailNotificationType.USER_ENABLED,
      title: 'Welcome',
      description: 'Welcome to FirstPlug',
    };

    it('should send email successfully', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-123' },
        error: null,
      });

      const result = await service.sendImmediate(
        'john@example.com',
        validProps,
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle Resend API errors', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'API Error' },
      });

      const result = await service.sendImmediate(
        'john@example.com',
        validProps,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('should throw BadRequestException for invalid email', async () => {
      await expect(
        service.sendImmediate('invalid-email', validProps),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing required fields', async () => {
      const invalidProps = { ...validProps, title: '' };

      await expect(
        service.sendImmediate('john@example.com', invalidProps),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send test copy when in test mode', async () => {
      // Configurar test mode
      process.env.EMAIL_TEST_RECIPIENT = 'test@example.com';
      const configServiceWithTest = new EmailConfigService();
      const serviceWithTest = new EmailService(configServiceWithTest);

      mockSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await serviceWithTest.sendImmediate('john@example.com', validProps);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should include button in email when provided', async () => {
      const propsWithButton = {
        ...validProps,
        buttonText: 'Click here',
        buttonUrl: 'https://example.com',
      };

      mockSend.mockResolvedValueOnce({
        data: { id: 'msg-123' },
        error: null,
      });

      await service.sendImmediate('john@example.com', propsWithButton);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Click here');
      expect(callArgs.html).toContain('https://example.com');
    });
  });
});
