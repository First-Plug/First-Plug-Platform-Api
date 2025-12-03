# 🔍 Validación Zod - Schemas por Categoría

## 📋 Common Delivery Schema

```typescript
const DeliveryDataSchema = z.object({
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  comments: z.string().optional(),
});
```

---

## 🖥️ Computer Schema

```typescript
const ComputerDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Computer'),
  os: z.enum(['macOS', 'Windows', 'Linux']).optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  processor: z.string().min(1, 'Processor is required'),
  ram: z.string().min(1, 'RAM is required'),
  storage: z.string().min(1, 'Storage is required'),
  screenSize: z.string().min(1, 'Screen size is required'),
  otherSpecifications: z.string().optional(),
  warranty: z.boolean().optional(),
  deviceEnrollment: z.boolean().optional(),
});
```

---

## 📺 Monitor Schema

```typescript
const MonitorDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Monitor'),
  quantity: z.number().int().positive(),
  brand: z.string().min(1),
  model: z.string().min(1),
  screenSize: z.string().min(1),
  resolution: z.string().min(1),
  additionalSpecs: z.string().optional(),
});
```

---

## 🎵 Audio Schema

```typescript
const AudioDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Audio'),
  quantity: z.number().int().positive(),
  brand: z.string().min(1),
  model: z.string().min(1),
  specifications: z.string().optional(),
});
```

---

## 🖱️ Peripherals Schema

```typescript
const PeripheralsDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Peripherals'),
  quantity: z.number().int().positive(),
  brand: z.string().min(1),
  model: z.string().min(1),
  type: z.string().min(1),
  additionalInfo: z.string().optional(),
});
```

---

## 🛍️ Merchandising Schema

```typescript
const MerchandisingDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Merchandising'),
  quantity: z.number().int().positive(),
  description: z.string().min(1),
  additionalRequirements: z.string().optional(),
});
```

---

## 📦 Other Schema

```typescript
const OtherDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Other'),
  quantity: z.number().int().positive(),
  description: z.string().min(1),
  additionalInfo: z.string().optional(),
});
```

---

## 📱 Phone Schema

```typescript
const PhoneDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Phone'),
  quantity: z.number().int().positive(),
  brand: z.string().min(1),
  model: z.string().min(1),
  additionalInfo: z.string().optional(),
});
```

---

## 📱 Tablet Schema

```typescript
const TabletDataSchema = DeliveryDataSchema.extend({
  category: z.literal('Tablet'),
});
```

---

## 🎯 Discriminated Union

```typescript
const ProductoDataSchema = z.discriminatedUnion('category', [
  ComputerDataSchema,
  MonitorDataSchema,
  AudioDataSchema,
  PeripheralsDataSchema,
  MerchandisingDataSchema,
  OtherDataSchema,
  PhoneDataSchema,
  TabletDataSchema,
]);
```

---

**Próximo paso**: Implementación del backend.

