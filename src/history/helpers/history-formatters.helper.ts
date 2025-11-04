import { ProductDocument } from '../../products/schemas/product.schema';
import { Office } from '../../offices/schemas/office.schema';
import { ShipmentDocument } from '../../shipments/schema/shipment.schema';

/**
 * 🏢 Helper para formatear datos de oficinas en history
 */
export class OfficeHistoryFormatter {
  /**
   * Formatear datos de oficina para history - CREATE
   */
  static formatForCreate(office: Office) {
    return {
      name: office.name,
      country: office.country,
      isDefault: office.isDefault,
      email: office.email || '',
      phone: office.phone || '',
      address: office.address || '',
      city: office.city || '',
      state: office.state || '',
      zipCode: office.zipCode || '',
    };
  }

  /**
   * Formatear datos de oficina para history - UPDATE
   * Solo incluye campos que realmente cambiaron
   */
  static formatForUpdate(oldOffice: Office, newOffice: Office) {
    const oldData: Record<string, any> = {};
    const newData: Record<string, any> = {};

    // Campos básicos siempre incluidos
    oldData.name = oldOffice.name;
    oldData.country = oldOffice.country;
    newData.name = newOffice.name;
    newData.country = newOffice.country;

    // Detectar campos que cambiaron
    const fieldsToCheck = [
      'name',
      'country',
      'isDefault',
      'email',
      'phone',
      'address',
      'city',
      'state',
      'zipCode',
    ];

    for (const field of fieldsToCheck) {
      if (oldOffice[field] !== newOffice[field]) {
        oldData[field] = oldOffice[field];
        newData[field] = newOffice[field];
      }
    }

    return { oldData, newData };
  }

  /**
   * Formatear datos de oficina para history - DELETE
   */
  static formatForDelete(
    office: Office,
    nonRecoverableProducts?: Array<{ serialNumber: string; name: string }>,
  ) {
    return {
      name: office.name,
      country: office.country,
      isDefault: office.isDefault,
      ...(nonRecoverableProducts &&
        nonRecoverableProducts.length > 0 && {
          nonRecoverableProducts,
        }),
    };
  }
}

/**
 * 📦 Helper para formatear datos de assets en history
 */
export class AssetHistoryFormatter {
  /**
   * Formatear location details para assets
   */
  static formatLocationDetails(
    location: string,
    product?: ProductDocument,
    assignedMember?: string,
  ) {
    const details: any = {};

    switch (location) {
      case 'Our office':
        if (product?.office) {
          details.name = product.office.officeName;
          details.country = product.office.officeCountryCode;
        }
        break;

      case 'FP warehouse':
        if (product?.fpWarehouse) {
          details.country = product.fpWarehouse.warehouseCountryCode;
          details.name = product.fpWarehouse.warehouseName;
        }
        break;

      case 'Employee':
        if (assignedMember) {
          details.memberName = assignedMember;
          // TODO: Agregar país del member si es necesario
        }
        break;
    }

    return details;
  }

  /**
   * Formatear datos completos de asset para history
   */
  static formatAssetData(
    product: ProductDocument,
    assignedMember?: string,
    additionalFields?: Record<string, any>,
  ) {
    const locationDetails = this.formatLocationDetails(
      product.location || '',
      product,
      assignedMember,
    );

    return {
      serialNumber: product.serialNumber,
      name: product.name,
      category: product.category,
      location: product.location,
      locationDetails,
      assignedEmail: product.assignedEmail || '',
      assignedMember: assignedMember || product.assignedMember || '',
      lastAssigned: product.lastAssigned || '',
      status: product.status,
      productCondition: product.productCondition,
      ...additionalFields,
    };
  }
}

/**
 * 🚢 Helper para formatear datos de shipments en history
 */
export class ShipmentHistoryFormatter {
  /**
   * Formatear location details para shipments
   */
  static formatShipmentLocationDetails(
    location: string,
    details?: Record<string, string>,
    locationData?: {
      officeName?: string;
      officeCountry?: string;
      warehouseCountry?: string;
      warehouseName?: string;
      memberName?: string;
      memberCountry?: string;
    },
  ) {
    const formatted: any = {};

    switch (location) {
      case 'Our office':
        if (locationData?.officeName) formatted.name = locationData.officeName;
        if (locationData?.officeCountry)
          formatted.country = locationData.officeCountry;
        break;

      case 'FP warehouse':
        if (locationData?.warehouseCountry)
          formatted.country = locationData.warehouseCountry;
        if (locationData?.warehouseName)
          formatted.name = locationData.warehouseName;
        break;

      default: // Employee name
        if (locationData?.memberName)
          formatted.memberName = locationData.memberName;
        if (locationData?.memberCountry)
          formatted.country = locationData.memberCountry;
        break;
    }

    // Agregar fechas si existen
    if (details?.desirableDate) formatted.desirableDate = details.desirableDate;

    return formatted;
  }

  /**
   * Formatear datos completos de shipment para history
   */
  static formatShipmentData(
    shipment: ShipmentDocument,
    originLocationData?: any,
    destinationLocationData?: any,
  ) {
    const originDetails = this.formatShipmentLocationDetails(
      shipment.origin,
      shipment.originDetails,
      originLocationData,
    );

    const destinationDetails = this.formatShipmentLocationDetails(
      shipment.destination,
      shipment.destinationDetails,
      destinationLocationData,
    );

    return {
      orderId: shipment.order_id,
      origin: shipment.origin,
      originDetails,
      destination: shipment.destination,
      destinationDetails,
      shipmentStatus: shipment.shipment_status,
      quantityProducts: shipment.quantity_products,
      products:
        shipment.products?.map((p) => ({
          productId: p.toString(), // Los products en shipment son ObjectIds
        })) || [],
    };
  }
}
