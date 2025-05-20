import { ShipmentDocument } from '../schema/shipment.schema';

const getAttribute = (
  attributes: { key: string; value: any }[],
  key: string,
) => {
  const attribute = attributes.find((attr) => attr.key === key);
  return attribute ? attribute.value : 'Key not found';
};

const getAddress = (
  address: string,
  apartment: string,
  city: string,
  state: string,
  country: string,
  zipCode: string,
) => {
  return `${address || ''} ${apartment || ''} ${city || ''} ${state || ''} ${country || ''} ${zipCode || ''}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'ASAP';

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

type Status = 'New' | 'Cancelled' | 'Consolidated' | 'Updated' | 'Missing Data';

interface CreateShipmentMessageParams {
  shipment: ShipmentDocument | Partial<ShipmentDocument>;
  tenantName: string;
  isOffboarding: boolean;
  status: Status;
  previousShipment?: Partial<ShipmentDocument> | null;
}

export const CreateShipmentMessageToSlack = ({
  shipment,
  tenantName,
  isOffboarding,
  status,
  previousShipment,
}: CreateShipmentMessageParams) => {
  const showComparison =
    (status === 'Consolidated' ||
      status === 'Updated' ||
      status === 'Missing Data') &&
    previousShipment;

  const message = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: isOffboarding
            ? `*Action:* Offboarding\n*Type:* ${status}\n*Tenant:* ${tenantName}`
            : `*Type:* ${status}\n*Tenant:* ${tenantName}`,
        },
      },
    ],
  };

  if (showComparison) {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Original shipment Order ID:* ${previousShipment?.order_id || ''}\n*Updated shipment Order ID:* ${shipment.order_id}\n*Original Desirable pickup date:* ${formatDate(previousShipment?.originDetails?.desirableDate || '')}\n*Updated Desirable pickup date:* ${formatDate(shipment.originDetails?.desirableDate || '')}\n*Original Desirable delivery date:* ${formatDate(previousShipment?.destinationDetails?.desirableDate || '')}\n*Updated Desirable delivery date:* ${formatDate(shipment.destinationDetails?.desirableDate || '')}\n*Original Quantity of products:* ${previousShipment?.snapshots?.length || 0}\n*Updated Quantity of products:* ${shipment.snapshots?.length || 0}`,
      },
    });
  } else {
    message.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Shipment Order ID:* ${shipment.order_id}\n*Desirable pickup date:* ${formatDate(shipment.originDetails?.desirableDate || '')}\n*Desirable delivery date:* ${formatDate(shipment.destinationDetails?.desirableDate || '')}\n*Quantity of products:* ${shipment.snapshots?.length || 0}`,
      },
    });
  }

  // Origin
  message.blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Origin:* ${shipment.origin || ''}\n*Address:* ${getAddress(
        shipment.originDetails?.address || '',
        shipment.originDetails?.apartment || '',
        shipment.originDetails?.city || '',
        shipment.originDetails?.state || '',
        shipment.originDetails?.country || '',
        shipment.originDetails?.zipCode || '',
      )}\n*Email:* ${shipment.originDetails?.email || ''}\n*Personal email:* ${shipment.originDetails?.personalEmail || ''}\n*Phone:* ${shipment.originDetails?.phone || ''}\n*DNI/CI/Passport:* ${shipment.originDetails?.dni || ''}`,
    },
  });

  // Products
  if (shipment.snapshots && shipment.snapshots.length > 0) {
    shipment.snapshots.forEach((product, index) => {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Product ${index + 1}:*\n*Category:* ${product.category || ''}\n*Brand:* ${getAttribute(product.attributes, 'brand')}\n*Model:* ${getAttribute(product.attributes, 'model')}\n*Name:* ${product.name || 'N/A'}\n*Serial:* ${product.serialNumber || 'N/A'}`,
        },
      });
    });
  }

  // Destination
  message.blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Destination:* ${shipment.destination || ''}\n*Address:* ${getAddress(
        shipment.destinationDetails?.address || '',
        shipment.destinationDetails?.apartment || '',
        shipment.destinationDetails?.city || '',
        shipment.destinationDetails?.state || '',
        shipment.destinationDetails?.country || '',
        shipment.destinationDetails?.zipCode || '',
      )}\n*Email:* ${shipment.destinationDetails?.email || ''}\n*Personal email:* ${shipment.destinationDetails?.personalEmail || ''}\n*Phone:* ${shipment.destinationDetails?.phone || ''}\n*DNI/CI/Passport:* ${shipment.destinationDetails?.dni || ''}`,
    },
  });

  return message;
};
