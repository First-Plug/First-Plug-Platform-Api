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
   * 🔍 Comparar dos productos y extraer solo los campos que cambiaron
   */
  static getChangedFields(oldProduct: any, newProduct: any) {
    const changes: { oldData: any; newData: any } = {
      oldData: {},
      newData: {},
    };

    // 🎯 Campos obligatorios que SIEMPRE se incluyen en UPDATE (aunque no cambien)
    const mandatoryFields = ['category', 'name', 'serialNumber'];

    // 📋 Campos básicos a comparar
    const basicFields = [
      'name',
      'category',
      'serialNumber',
      'location',
      'assignedEmail',
      'assignedMember',
      'lastAssigned',
      'status',
      'productCondition',
      'recoverable',
      'additionalInfo',
      'acquisitionDate',
      'price', // 💰 Agregar price para capturar cambios de precio
    ];

    // 🎯 Incluir campos obligatorios SIEMPRE
    for (const field of mandatoryFields) {
      changes.oldData[field] = oldProduct[field];
      changes.newData[field] = newProduct[field];
    }

    // 🔍 Comparar campos básicos (solo agregar si cambiaron Y no están ya incluidos)
    for (const field of basicFields) {
      const oldValue = oldProduct[field];
      const newValue = newProduct[field];

      // 🔍 Comparación mejorada para objetos (como price)
      const hasChanged = this.hasFieldChanged(oldValue, newValue);

      if (hasChanged && !mandatoryFields.includes(field)) {
        changes.oldData[field] = oldValue;
        changes.newData[field] = newValue;
      }
    }

    // 🏷️ Comparar attributes array (más complejo)
    const oldAttrs = this.attributesToObject(oldProduct.attributes || []);
    const newAttrs = this.attributesToObject(newProduct.attributes || []);

    // 🎯 Attributes obligatorios que SIEMPRE se incluyen en UPDATE
    const mandatoryAttributes = ['brand', 'model'];

    // 🎯 Incluir attributes obligatorios SIEMPRE
    for (const key of mandatoryAttributes) {
      if (!changes.oldData.attributes) changes.oldData.attributes = {};
      if (!changes.newData.attributes) changes.newData.attributes = {};

      changes.oldData.attributes[key] = oldAttrs[key] || null;
      changes.newData.attributes[key] = newAttrs[key] || null;
    }

    const allAttrKeys = new Set([
      ...Object.keys(oldAttrs),
      ...Object.keys(newAttrs),
    ]);

    // 🔍 Comparar otros attributes (solo agregar si cambiaron Y no están ya incluidos)
    for (const key of allAttrKeys) {
      const oldValue = oldAttrs[key];
      const newValue = newAttrs[key];

      if (oldValue !== newValue && !mandatoryAttributes.includes(key)) {
        if (!changes.oldData.attributes) changes.oldData.attributes = {};
        if (!changes.newData.attributes) changes.newData.attributes = {};

        changes.oldData.attributes[key] = oldValue || null;
        changes.newData.attributes[key] = newValue || null;
      }
    }

    // 📍 Comparar location details si cambió la ubicación
    if (changes.oldData.location || changes.newData.location) {
      const oldLocationDetails = this.formatLocationDetails(
        oldProduct.location || '',
        oldProduct,
        oldProduct.assignedMember,
      );
      const newLocationDetails = this.formatLocationDetails(
        newProduct.location || '',
        newProduct,
        newProduct.assignedMember,
      );

      changes.oldData.locationDetails = oldLocationDetails;
      changes.newData.locationDetails = newLocationDetails;
    }

    return changes;
  }

  /**
   * 🏷️ Convertir array de attributes a objeto para fácil comparación
   */
  static attributesToObject(attributes: any[]): Record<string, string> {
    const obj: Record<string, string> = {};

    for (const attr of attributes) {
      if (attr && attr.key && attr.value !== undefined) {
        obj[attr.key] = attr.value;
      }
    }

    return obj;
  }

  /**
   * 🔍 Comparar si un campo cambió (maneja objetos y primitivos)
   */
  static hasFieldChanged(oldValue: any, newValue: any): boolean {
    // 🔍 Si ambos son null/undefined, no cambió
    if (oldValue == null && newValue == null) {
      return false;
    }

    // 🔍 Si uno es null y el otro no, cambió
    if (oldValue == null || newValue == null) {
      return true;
    }

    // 🔍 Para objetos (como price), comparar JSON
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    // 🔍 Para primitivos, comparación directa
    return oldValue !== newValue;
  }
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
    // 🎯 CAPTURAR TODOS LOS CAMPOS del producto (no solo los predefinidos)
    const productObj = product.toObject ? product.toObject() : product;

    // 📋 Crear copia completa excluyendo campos internos de MongoDB
    const data: any = { ...productObj };

    // 🗑️ Eliminar campos internos de MongoDB que no necesitamos en history
    delete data._id;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.isDeleted;
    delete data.deletedAt;

    // 📍 Agregar location details mejorados
    const locationDetails = this.formatLocationDetails(
      product.location || '',
      product,
      assignedMember,
    );

    // ✅ Asegurar campos básicos y agregar location details
    data.serialNumber = data.serialNumber || data.lastSerialNumber || null;
    data.name = data.name || '';
    data.assignedEmail = data.assignedEmail || '';
    data.assignedMember = assignedMember || data.assignedMember || '';
    data.lastAssigned = data.lastAssigned || '';
    data.locationDetails = locationDetails;

    // 🔧 Agregar campos adicionales si se proporcionan
    if (additionalFields) {
      Object.assign(data, additionalFields);
    }

    return data;
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
