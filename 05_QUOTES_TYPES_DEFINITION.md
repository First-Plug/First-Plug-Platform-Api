# 🔧 07 - Definición de Tipos - Multi-Step Form

## 📋 Quote Schema Principal

```typescript
interface Quote {
  _id: ObjectId;
  tenantId: ObjectId;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  requestType: 'Comprar productos';
  requestData: ProductoData;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}
```

---

## 📋 ProductoData - Discriminated Union por Categoría

```typescript
type ProductoData =
  | ComputerData
  | MonitorData
  | AudioData
  | PeripheralsData
  | MerchandisingData
  | OtherData
  | PhoneData
  | TabletData;

// === COMMON DELIVERY DATA ===
interface DeliveryData {
  country: string;
  city: string;
  deliveryDate: string;
  comments?: string;
}

// === COMPUTER ===
interface ComputerData extends DeliveryData {
  category: 'Computer';
  os?: 'macOS' | 'Windows' | 'Linux';
  quantity: number;
  brand: string;
  model: string;
  processor: string;
  ram: string;
  storage: string;
  screenSize: string;
  otherSpecifications?: string;
  warranty?: boolean;
  deviceEnrollment?: boolean;
}

// === MONITOR ===
interface MonitorData extends DeliveryData {
  category: 'Monitor';
  quantity: number;
  brand: string;
  model: string;
  screenSize: string;
  resolution: string;
  additionalSpecs?: string;
}

// === AUDIO ===
interface AudioData extends DeliveryData {
  category: 'Audio';
  quantity: number;
  brand: string;
  model: string;
  specifications?: string;
}

// === PERIPHERALS ===
interface PeripheralsData extends DeliveryData {
  category: 'Peripherals';
  quantity: number;
  brand: string;
  model: string;
  type: string;
  additionalInfo?: string;
}

// === MERCHANDISING ===
interface MerchandisingData extends DeliveryData {
  category: 'Merchandising';
  quantity: number;
  description: string;
  additionalRequirements?: string;
}

// === OTHER ===
interface OtherData extends DeliveryData {
  category: 'Other';
  quantity: number;
  description: string;
  additionalInfo?: string;
}

// === PHONE ===
interface PhoneData extends DeliveryData {
  category: 'Phone';
  quantity: number;
  brand: string;
  model: string;
  additionalInfo?: string;
}

// === TABLET ===
interface TabletData extends DeliveryData {
  category: 'Tablet';
  // Directo a Pantalla 3 (sin campos específicos)
}
```

## 🔍 Validación con Zod

Ver `QUOTES_ZOD_VALIDATION.md` para schemas específicos por categoría.

---

**Próximo paso**: Implementación del backend.
