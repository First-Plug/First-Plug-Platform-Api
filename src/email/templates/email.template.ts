/**
 * Email Template - Único y Dinámico
 * Template responsive que se adapta a diferentes tipos de notificaciones
 */

import { EmailProps } from '../email.types';

export class EmailTemplate {
  /**
   * Genera el HTML del email basado en las props
   * Template único que se adapta a diferentes tipos de notificaciones
   */
  static render(props: EmailProps): string {
    const { title, description, buttonText, buttonUrl, recipientName } = props;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      background: white;
      padding: 40px 20px;
      text-align: center;
      border-bottom: 1px solid #eee;
    }


    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #555;
    }
    
    .description {
      font-size: 16px;
      line-height: 1.8;
      color: #666;
      margin-bottom: 30px;
    }
    
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    
    .button {
      display: inline-block;
      background: #4FE8B7;
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: opacity 0.3s ease;
    }

    .button:hover {
      opacity: 0.85;
    }
    
    .footer {
      background-color: #f9f9f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
    
    .footer-link {
      color: #4c83ee;
      text-decoration: none;
    }
    
    .footer-link:hover {
      text-decoration: underline;
    }
    
    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      
      .header {
        padding: 30px 20px;
      }
      
      .header h1 {
        font-size: 24px;
      }
      
      .content {
        padding: 20px;
      }
      
      .button {
        display: block;
        width: 100%;
        padding: 16px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${title}</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <p class="greeting">Hi ${recipientName},</p>
      
      <p class="description">${description}</p>
      
      ${
        buttonText && buttonUrl
          ? `
      <div class="button-container">
        <a href="${buttonUrl}" class="button">${buttonText}</a>
      </div>
      `
          : ''
      }
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>© 2026 First Plug. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Genera el texto plano del email
   */
  static renderText(props: EmailProps): string {
    const { title, description, buttonText, buttonUrl, recipientName } = props;

    let text = `${title}\n\n`;
    text += `Hi ${recipientName},\n\n`;
    text += `${description}\n`;

    if (buttonText && buttonUrl) {
      text += `\n${buttonText}: ${buttonUrl}\n`;
    }

    text += `\n\n© 2026 First Plug. All rights reserved.`;

    return text;
  }
}
