/**
 * Email Config Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailConfigService } from './email.config';

describe('EmailConfigService', () => {
  let service: EmailConfigService;
  let configService: ConfigService;

  describe('with valid configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailConfigService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  RESEND_API_KEY: 'test-api-key-123',
                  EMAIL_FROM: 'noreply@firstplug.com',
                  EMAIL_FROM_NAME: 'FirstPlug',
                  EMAIL_TEST_RECIPIENT: undefined,
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<EmailConfigService>(EmailConfigService);
      configService = module.get<ConfigService>(ConfigService);
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
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailConfigService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  RESEND_API_KEY: 'test-api-key-123',
                  EMAIL_FROM: 'noreply@firstplug.com',
                  EMAIL_FROM_NAME: 'FirstPlug',
                  EMAIL_TEST_RECIPIENT: 'test@example.com',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<EmailConfigService>(EmailConfigService);
    });

    it('should return test recipient when configured', () => {
      expect(service.getTestRecipient()).toBe('test@example.com');
    });

    it('should return true for isTestMode when test recipient configured', () => {
      expect(service.isTestMode()).toBe(true);
    });
  });

  describe('with invalid configuration', () => {
    it('should throw error when RESEND_API_KEY is missing', async () => {
      expect(() => {
        Test.createTestingModule({
          providers: [
            EmailConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  const config: Record<string, string> = {
                    RESEND_API_KEY: '',
                    EMAIL_FROM: 'noreply@firstplug.com',
                    EMAIL_FROM_NAME: 'FirstPlug',
                  };
                  return config[key];
                }),
              },
            },
          ],
        });
      }).toThrow();
    });

    it('should throw error when EMAIL_FROM is invalid', async () => {
      expect(() => {
        Test.createTestingModule({
          providers: [
            EmailConfigService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  const config: Record<string, string> = {
                    RESEND_API_KEY: 'test-key',
                    EMAIL_FROM: 'invalid-email',
                    EMAIL_FROM_NAME: 'FirstPlug',
                  };
                  return config[key];
                }),
              },
            },
          ],
        });
      }).toThrow();
    });
  });
});

