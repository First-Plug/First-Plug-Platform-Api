import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlackHelper {
  private readonly logger = new Logger(SlackHelper.name);

  /**
   * Enviar mensaje a Slack usando webhook
   * No-blocking: no espera respuesta
   */
  async sendToSlack(payload: any): Promise<void> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL_PUBLIC_QUOTES;
      if (!webhookUrl) {
        this.logger.warn('SLACK_WEBHOOK_URL_PUBLIC_QUOTES not configured');
        return;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(
          `Failed to send Slack message: ${response.statusText}`,
        );
        return;
      }

      this.logger.log('Slack message sent successfully');
    } catch (error) {
      this.logger.error('Error sending Slack message:', error);
    }
  }
}

