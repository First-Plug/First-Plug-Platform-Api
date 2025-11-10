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
  static formatForDelete(office: Office) {
    return {
      name: office.name,
      country: office.country,
      isDefault: office.isDefault,
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

    // 🎯 SIEMPRE inicializar attributes como array (OBLIGATORIO para frontend)
    changes.oldData.attributes = [];
    changes.newData.attributes = [];

    // 🎯 Incluir attributes obligatorios SIEMPRE (como array)
    for (const key of mandatoryAttributes) {
      changes.oldData.attributes.push({ key, value: oldAttrs[key] || null });
      changes.newData.attributes.push({ key, value: newAttrs[key] || null });
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
        // Agregar a oldData.attributes como array
        const oldAttr = changes.oldData.attributes.find(
          (attr: any) => attr.key === key,
        );
        if (!oldAttr) {
          changes.oldData.attributes.push({ key, value: oldValue || null });
        }

        // Agregar a newData.attributes como array
        const newAttr = changes.newData.attributes.find(
          (attr: any) => attr.key === key,
        );
        if (!newAttr) {
          changes.newData.attributes.push({ key, value: newValue || null });
        }
      }
    }

    // 🏳️ Agregar country code si es Employee (SIMPLIFICADO)
    if (changes.oldData.location === 'Employee') {
      const oldCountry = this.extractMemberCountryCode(
        oldProduct.location || '',
        this.extractMemberCountry(oldProduct),
      );
      if (oldCountry) {
        changes.oldData.country = oldCountry;
      }
    }

    if (changes.newData.location === 'Employee') {
      const newCountry = this.extractMemberCountryCode(
        newProduct.location || '',
        this.extractMemberCountry(newProduct),
      );
      if (newCountry) {
        changes.newData.country = newCountry;
      }
    }

    // 🔒 GARANTIZAR que attributes siempre sea array (nunca undefined/null)
    if (!Array.isArray(changes.oldData.attributes)) {
      changes.oldData.attributes = [];
    }
    if (!Array.isArray(changes.newData.attributes)) {
      changes.newData.attributes = [];
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
   * 🏳️ Extraer country code del member desde el producto
   * NOTA: Este método es limitado porque no tiene acceso a la base de datos
   * Para casos complejos, se debe pasar el memberCountry desde el servicio
   */
  static extractMemberCountry(product: any): string | undefined {
    // 🎯 Caso 1: Producto tiene memberData (GlobalProduct o producto sincronizado)
    if (product.memberData?.memberCountry) {
      return product.memberData.memberCountry;
    }

    // 🎯 Caso 2: Producto embebido en member (tiene acceso directo al country del member)
    if (product._parent && product._parent.country) {
      return product._parent.country;
    }

    // ⚠️ Caso 3: Producto standalone - no podemos obtener el country sin consulta DB
    // En este caso, el servicio debe pasar el memberCountry explícitamente
    return undefined;
  }
  /**
   * 🏳️ Extraer solo el country code para location Employee
   * SIMPLIFICADO: Solo devuelve el country, no un objeto completo
   */
  static extractMemberCountryCode(
    location: string,
    memberCountry?: string,
  ): string | undefined {
    if (location === 'Employee' && memberCountry) {
      return memberCountry;
    }
    return undefined;
  }

  /**
   * Formatear datos completos de asset para history
   */
  static formatAssetData(
    product: ProductDocument,
    assignedMember?: string,
    additionalFields?: Record<string, any>,
    memberCountry?: string,
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

    // ✅ Asegurar campos básicos
    data.serialNumber = data.serialNumber || data.lastSerialNumber || null;
    data.name = data.name || '';
    data.assignedEmail = data.assignedEmail || '';
    data.assignedMember = assignedMember || data.assignedMember || '';
    data.lastAssigned = data.lastAssigned || '';

    // 🏳️ Agregar country code y location details según la location
    if (product.location === 'Employee') {
      const countryCode = this.extractMemberCountryCode(
        product.location,
        memberCountry || this.extractMemberCountry(product),
      );
      if (countryCode) {
        data.country = countryCode;
      }
    } else if (
      product.location === 'Our office' &&
      product.office?.officeCountryCode
    ) {
      data.country = product.office.officeCountryCode;
      // ✅ AGREGAR: Incluir nombre de la oficina
      console.log('🏢 [DEBUG] Office data:', {
        hasOffice: !!product.office,
        officeName: product.office?.officeName,
        officeCountryCode: product.office?.officeCountryCode,
      });
      if (product.office.officeName) {
        data.officeName = product.office.officeName;
        console.log('✅ [DEBUG] Added officeName:', data.officeName);
      } else {
        console.log('❌ [DEBUG] No officeName found');
      }
    } else if (
      product.location === 'FP warehouse' &&
      product.fpWarehouse?.warehouseCountryCode
    ) {
      data.country = product.fpWarehouse.warehouseCountryCode;
    }

    // 🔧 Agregar campos adicionales si se proporcionan
    if (additionalFields) {
      Object.assign(data, additionalFields);
    }

    // 🔒 GARANTIZAR que attributes siempre sea array (nunca undefined/null)
    if (!Array.isArray(data.attributes)) {
      data.attributes = [];
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
   * ✅ MANTENER estructura original para compatibilidad con frontend
   */
  static formatShipmentData(
    shipment: ShipmentDocument,
    originLocationData?: any,
    destinationLocationData?: any,
  ) {
    // 🎯 CAPTURAR TODOS LOS CAMPOS del shipment (estructura completa)
    const shipmentObj = shipment.toObject ? shipment.toObject() : shipment;

    // 📋 Crear copia completa excluyendo campos internos de MongoDB
    const data: any = { ...shipmentObj };

    // 🗑️ Eliminar campos internos de MongoDB que no necesitamos en history
    delete data.__v;
    delete data.isDeleted;
    delete data.deletedAt;

    // 🌍 Mejorar originDetails y destinationDetails si se proporcionan datos adicionales
    if (originLocationData) {
      const enhancedOriginDetails = this.formatShipmentLocationDetails(
        shipment.origin,
        shipment.originDetails,
        originLocationData,
      );
      data.originDetails = enhancedOriginDetails;
    }

    if (destinationLocationData) {
      const enhancedDestinationDetails = this.formatShipmentLocationDetails(
        shipment.destination,
        shipment.destinationDetails,
        destinationLocationData,
      );
      data.destinationDetails = enhancedDestinationDetails;
    }

    return data;
  }
}
