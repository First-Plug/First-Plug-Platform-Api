import { Quote } from '../interfaces/quote.interface';
import { countryCodes } from 'src/shipments/helpers/countryCodes';

/**
 * Helper para acceder a propiedades de forma segura
 */
const getProperty = (obj: any, key: string): any => {
  return obj?.[key];
};

/**
 * Convierte código de país a nombre
 */
const convertCountryCodeToName = (countryCode: string): string => {
  if (!countryCode) return '';

  // Casos especiales que no se convierten
  if (countryCode === 'Our office' || countryCode === 'FP warehouse') {
    return countryCode;
  }

  // Si ya es un nombre (no código de 2 letras), devolverlo tal como está
  if (countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
    return countryCode;
  }

  // Crear mapa inverso: código -> nombre
  const codeToName = Object.entries(countryCodes).reduce(
    (acc, [name, code]) => {
      acc[code] = name;
      return acc;
    },
    {} as Record<string, string>,
  );

  return codeToName[countryCode] || countryCode;
};

/**
 * Formatea fecha a formato DD/MM/YYYY (solo días, sin hora)
 */
const formatDateToDay = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Construye el mensaje de Slack para una quote según el formato especificado
 * Soporta múltiples categorías de productos con campos específicos para cada una
 * @param quote - Documento de quote
 * @param actionType - Tipo de acción: 'New' (crear), 'Updated' (actualizar), 'Cancelled' (cancelar)
 */
export const CreateQuoteMessageToSlack = (
  quote: Quote,
  actionType: 'New' | 'Updated' | 'Cancelled' = 'New',
) => {
  // Construir bloques de detalles para cada producto
  const productBlocks = quote.products.flatMap(
    (product: any, index: number) => {
      const blocks: any[] = [];

      // Encabezado del producto
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Item ${index + 1}: x${product.quantity} ${product.category}*`,
        },
      });

      // Información de entrega
      const deliveryInfo: string[] = [];
      if (product.deliveryDate)
        deliveryInfo.push(
          `*Required Delivery Date:* ${formatDateToDay(product.deliveryDate)}`,
        );
      if (product.country || product.city) {
        const countryName = convertCountryCodeToName(product.country);
        const location = [countryName, product.city].filter(Boolean).join(', ');
        deliveryInfo.push(`*Location:* ${location}`);
      }
      if (product.comments)
        deliveryInfo.push(`*Additional quote comments:* ${product.comments}`);

      if (deliveryInfo.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: deliveryInfo.join('\n'),
          },
        });
      }

      // Especificaciones según categoría
      const specs: string[] = [];

      // Computer
      if (product.category === 'Computer') {
        if (product.os) specs.push(`*OS:* ${product.os}`);
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.processor && product.processor.length > 0)
          specs.push(`*Processor:* ${product.processor.join(', ')}`);
        if (product.ram && product.ram.length > 0)
          specs.push(`*RAM:* ${product.ram.join(', ')}`);
        if (product.storage && product.storage.length > 0)
          specs.push(`*Storage:* ${product.storage.join(', ')}`);
        if (product.screenSize && product.screenSize.length > 0)
          specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
        if (product.extendedWarranty)
          specs.push(
            `*Extended warranty and extra years:* ${product.extendedWarrantyYears} años`,
          );
        if (product.deviceEnrollment)
          specs.push(`*Device Enrollment (ABM/Intune/MDM setup):* Sí`);
      }
      // Monitor
      else if (product.category === 'Monitor') {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.screenSize && product.screenSize.length > 0)
          specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
        if (product.screenTechnology)
          specs.push(`*Screen Technology:* ${product.screenTechnology}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Audio
      else if (product.category === 'Audio') {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Peripherals
      else if (product.category === 'Peripherals') {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Merchandising
      else if (product.category === 'Merchandising') {
        const description = getProperty(product, 'description');
        if (description) specs.push(`*Description:* ${description}`);
        const additionalRequirements = getProperty(
          product,
          'additionalRequirements',
        );
        if (additionalRequirements)
          specs.push(`*Additional requirements:* ${additionalRequirements}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Phone
      else if (product.category === 'Phone') {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Furniture
      else if (product.category === 'Furniture') {
        if (product.furnitureType)
          specs.push(`*Furniture Type:* ${product.furnitureType}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Tablet
      else if (product.category === 'Tablet') {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.screenSize && product.screenSize.length > 0)
          specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }
      // Other
      else {
        if (product.brand && product.brand.length > 0)
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        if (product.model && product.model.length > 0)
          specs.push(`*Model:* ${product.model.join(', ')}`);
        if (product.otherSpecifications)
          specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      }

      if (specs.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: specs.join('\n'),
          },
        });
      }

      blocks.push({
        type: 'divider',
      });

      return blocks;
    },
  );

  const message = {
    text: `📋 Pedido de cotización n°: ${quote.requestId}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📋 Pedido de cotización n°: ${quote.requestId}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Type:*\n${actionType}`,
          },
          {
            type: 'mrkdwn',
            text: `*Tenant:*\n${quote.tenantName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Items requested:*\n${quote.products.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*userName:*\n${quote.userName || quote.userEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*usermail:*\n${quote.userEmail}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      ...productBlocks.slice(0, -1), // Remover último divider
    ],
  };

  return message;
};
