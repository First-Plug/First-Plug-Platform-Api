import { Injectable, Logger } from '@nestjs/common';
import { IncomingWebhook } from '@slack/webhook';

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

  async sendOffboardingMessage(
    member: any,
    products: any,
    tenantName: string,
  ): Promise<{ message: string }> {
    const slackOffboardingWebhookUrl =
      process.env.SLACK_WEBHOOK_URL_OFFBOARDING;

    if (!slackOffboardingWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL_OFFBOARDING is not defined');
    }

    const webhook = new IncomingWebhook(slackOffboardingWebhookUrl);

    const memberOffboardingMessage = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Nombre y apellido*: ${member.firstName} ${member.lastName}\n` +
          `*DNI/CI*: ${member.dni}\n` +
          `*Dirección*: ${member.country}, ${member.city}, ${member.address}, ${member.apartment ?? ''}\n` +
          `*Código Postal*: ${member.zipCode}\n` +
          `*Teléfono*: +${member.phone}\n` +
          `*Correo Personal*: ${member.personalEmail}`,
      },
    };

    const productsSend = products.flatMap((product, index) => {
      const productRecoverable = product.product;

      const brandAttribute = productRecoverable.attributes.find(
        (attribute) => attribute.key === 'brand',
      );
      const modelAttribute = productRecoverable.attributes.find(
        (attribute) => attribute.key === 'model',
      );

      const brand = brandAttribute ? brandAttribute.value : '';
      const model = modelAttribute ? modelAttribute.value : '';
      const name = productRecoverable.name ? productRecoverable.name : '';
      const serialNumber = productRecoverable.serialNumber
        ? productRecoverable.serialNumber
        : '';

      const category = productRecoverable.category;

      let relocationAction = '';
      let newMemberInfo = '';

      switch (product.relocation) {
        case 'FP warehouse':
          relocationAction = 'enviar a FP Warehouse';
          break;
        case 'My office':
          relocationAction = 'enviar a oficina del cliente';
          break;
        case 'New employee':
          relocationAction = 'enviar a nuevo miembro\n';
          newMemberInfo =
            `\n*Nombre y apellido*: ${product.newMember.firstName} ${product.newMember.lastName}\n` +
            `*DNI/CI*: ${product.newMember.dni ?? ''}\n` +
            `*Dirección*: ${product.newMember.country}, ${product.newMember.city}, ${product.newMember.address}, ${product.newMember.apartment ?? ''}\n` +
            `*Código Postal*: ${product.newMember.zipCode}\n` +
            `*Teléfono*: +${product.newMember.phone}\n` +
            `*Correo Personal*: ${product.newMember.personalEmail}`;
          break;
      }

      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Producto ${index + 1}*: \n` +
              `Categoría: ${category}\n` +
              `Marca: ${brand}\n` +
              `Modelo: ${model}\n` +
              `Nombre: ${name}\n` +
              `Serial: ${serialNumber}\n` +
              `Acción: ${relocationAction}` +
              newMemberInfo,
          },
        },
        {
          type: 'divider',
        },
      ];
    });

    try {
      await webhook.send({
        channel: 'offboardings',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Offboarding: ${tenantName}*`,
            },
          },
          memberOffboardingMessage,
          {
            type: 'divider',
          },
          ...productsSend.slice(0, -1),
        ],
      });

      return { message: 'Notification sent to Slack' };
    } catch (error) {
      console.error('Error sending notification to Slack:', error);
      throw new Error('Failed to send notification to Slack');
    }
  }
}
