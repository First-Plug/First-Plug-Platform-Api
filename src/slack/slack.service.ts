import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  async sendMessage(message: any): Promise<void> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL_SHIPMENTS;
      if (!webhookUrl) {
        this.logger.warn('Slack webhook URL not configured');
        return;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Failed to send Slack message: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Error sending Slack message:', error);
    }
  }
}
