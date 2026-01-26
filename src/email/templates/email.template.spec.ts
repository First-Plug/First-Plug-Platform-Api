/**
 * Email Template Tests
 */

import { EmailTemplate } from './email.template';
import { EmailNotificationType } from '../email.types';

describe('EmailTemplate', () => {
  const baseProps = {
    recipientName: 'John Doe',
    recipientEmail: 'john@example.com',
    tenantName: 'Test Tenant',
    type: EmailNotificationType.USER_ENABLED,
    title: 'Welcome to First Plug',
    description: 'You have been successfully enabled in First Plug',
  };

  describe('render', () => {
    it('should render HTML template with basic content', () => {
      const html = EmailTemplate.render(baseProps);

      expect(html).toContain('Welcome to First Plug');
      expect(html).toContain('John Doe');
      expect(html).toContain(
        'You have been successfully enabled in First Plug',
      );
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should include button when buttonText and buttonUrl are provided', () => {
      const propsWithButton = {
        ...baseProps,
        buttonText: 'Get Started',
        buttonUrl: 'https://example.com/start',
      };

      const html = EmailTemplate.render(propsWithButton);

      expect(html).toContain('Get Started');
      expect(html).toContain('https://example.com/start');
      expect(html).toContain('class="button"');
    });

    it('should not include button when buttonText is missing', () => {
      const propsWithoutButton = {
        ...baseProps,
        buttonUrl: 'https://example.com/start',
      };

      const html = EmailTemplate.render(propsWithoutButton);

      expect(html).not.toContain('class="button"');
    });

    it('should not include button when buttonUrl is missing', () => {
      const propsWithoutButton = {
        ...baseProps,
        buttonText: 'Get Started',
      };

      const html = EmailTemplate.render(propsWithoutButton);

      expect(html).not.toContain('class="button"');
    });

    it('should be responsive for mobile devices', () => {
      const html = EmailTemplate.render(baseProps);

      expect(html).toContain('@media (max-width: 600px)');
      expect(html).toContain('max-width: 600px');
    });

    it('should include proper styling', () => {
      const html = EmailTemplate.render(baseProps);

      expect(html).toContain('background: #4FE8B7');
      expect(html).toContain('color: white');
      expect(html).toContain('border-radius');
    });

    it('should include footer with links', () => {
      const html = EmailTemplate.render(baseProps);

      expect(html).toContain('© 2026 First Plug');
      expect(html).toContain('https://firstplug.com');
      expect(html).toContain('Política de privacidad');
    });
  });

  describe('renderText', () => {
    it('should render plain text version', () => {
      const text = EmailTemplate.renderText(baseProps);

      expect(text).toContain('Welcome to First Plug');
      expect(text).toContain('John Doe');
      expect(text).toContain(
        'You have been successfully enabled in First Plug',
      );
      expect(text).not.toContain('<html>');
      expect(text).not.toContain('</html>');
    });

    it('should include button link in text version', () => {
      const propsWithButton = {
        ...baseProps,
        buttonText: 'Get Started',
        buttonUrl: 'https://example.com/start',
      };

      const text = EmailTemplate.renderText(propsWithButton);

      expect(text).toContain('Get Started');
      expect(text).toContain('https://example.com/start');
    });

    it('should not include button in text version when missing', () => {
      const text = EmailTemplate.renderText(baseProps);

      expect(text).not.toContain('https://');
    });

    it('should include footer', () => {
      const text = EmailTemplate.renderText(baseProps);

      expect(text).toContain('© 2026 First Plug');
    });
  });
});
