# 🔐 QUOTES - Zod Validation Schemas

## 📋 Zod Schemas Completos

```typescript
import { z } from 'zod';

export const ComputerItemSchema = z
  .object({
    category: z.literal('Computer'),
    os: z.enum(['macOS', 'Windows', 'Linux']).optional(),
    quantity: z
      .number()
      .int('Quantity debe ser un número entero')
      .positive('Quantity debe ser mayor a 0'),
    brand: z.array(z.string()).optional(),
    model: z.array(z.string()).optional(),
    processor: z.array(z.string()).optional(),
    ram: z.array(z.string()).optional(),
    storage: z.array(z.string()).optional(),
    screenSize: z.array(z.string()).optional(),
    otherSpecifications: z.string().optional(),
    extendedWarranty: z.boolean().optional(),
    extendedWarrantyYears: z
      .number()
      .int('Extra years debe ser un número entero')
      .positive('Extra years debe ser mayor a 0')
      .optional(),
    deviceEnrollment: z.boolean().optional(),
    country: z
      .string()
      .min(1, 'Country es obligatorio')
      .max(2, 'Country debe ser un código ISO válido'),
    city: z.string().optional(),
    deliveryDate: z.date().optional(),
    comments: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.extendedWarranty === true && !data.extendedWarrantyYears) {
        return false;
      }
      return true;
    },
    {
      message: 'Extra years es obligatorio si Extended Warranty está tildado',
      path: ['extendedWarrantyYears'],
    },
  );

export const CreateQuoteSchema = z.object({
  products: z
    .array(ComputerItemSchema)
    .min(1, 'Al menos un producto es requerido'),
});

export const UpdateQuoteSchema = z.object({
  products: z
    .array(ComputerItemSchema)
    .min(1, 'Al menos un producto es requerido')
    .optional(),
  isDeleted: z.boolean().optional(),
});

export type ComputerItem = z.infer<typeof ComputerItemSchema>;
export type CreateQuoteDTO = z.infer<typeof CreateQuoteSchema>;
export type UpdateQuoteDTO = z.infer<typeof UpdateQuoteSchema>;
```

---

## 🧪 Ejemplos de Validación

### ✅ Válido

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 2,
      "country": "US",
      "brand": ["Apple", "Dell"],
      "extendedWarranty": true,
      "extendedWarrantyYears": 2
    }
  ]
}
```

### ❌ Inválido - Falta quantity

```json
{
  "products": [
    {
      "category": "Computer",
      "country": "US"
    }
  ]
}
```

### ❌ Inválido - Falta country

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 2
    }
  ]
}
```

### ❌ Inválido - extendedWarranty sin years

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 2,
      "country": "US",
      "extendedWarranty": true
    }
  ]
}
```

---

## 📁 Ubicación en Proyecto

```
src/quotes/validations/
├── computer-item.zod.ts
├── create-quote.zod.ts
├── update-quote.zod.ts
└── index.ts
```

---

## 🔑 Puntos Clave

- ✅ Arrays (`brand`, `model`, etc.) pueden estar vacíos
- ✅ `quantity` y `country` son obligatorios
- ✅ `extendedWarrantyYears` solo si `extendedWarranty === true`
- ✅ Validación condicional con `.refine()`

