/**
 * Email Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigService } from './email.config';
import { EmailNotificationType } from './email.types';

// Mock de Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: EmailConfigService;
  let mockResend: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EmailConfigService,
          useValue: {
            getResendConfig: jest.fn().mockReturnValue({
              apiKey: 'test-key',
              fromEmail: 'test@example.com',
              fromName: 'Test',
            }),
            isTestMode: jest.fn().mockReturnValue(false),
            getTestRecipient: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<EmailConfigService>(EmailConfigService);

    // Obtener el mock de Resend
    const Resend = require('resend').Resend;
    mockResend = Resend.mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      mockResend.emails.send.mockResolvedValueOnce({
        data: { id: 'msg-123' },
        error: null,
      });

      const result = await service.sendImmediate('john@example.com', validProps);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockResend.emails.send).toHaveBeenCalledTimes(1);
    });

    it('should handle Resend API errors', async () => {
      mockResend.emails.send.mockResolvedValueOnce({
        data: null,
        error: { message: 'API Error' },
      });

      const result = await service.sendImmediate('john@example.com', validProps);

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
      jest.spyOn(configService, 'isTestMode').mockReturnValue(true);
      jest.spyOn(configService, 'getTestRecipient').mockReturnValue('test@example.com');

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await service.sendImmediate('john@example.com', validProps);

      expect(mockResend.emails.send).toHaveBeenCalledTimes(2);
    });

    it('should include button in email when provided', async () => {
      const propsWithButton = {
        ...validProps,
        buttonText: 'Click here',
        buttonUrl: 'https://example.com',
      };

      mockResend.emails.send.mockResolvedValueOnce({
        data: { id: 'msg-123' },
        error: null,
      });

      await service.sendImmediate('john@example.com', propsWithButton);

      const callArgs = mockResend.emails.send.mock.calls[0][0];
      expect(callArgs.html).toContain('Click here');
      expect(callArgs.html).toContain('https://example.com');
    });
  });
});

