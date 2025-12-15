# 📋 QUOTES FEATURE - PLANIFICACIÓN

## 🎯 Resumen Ejecutivo

Feature de cotizaciones (presupuestos) para productos. Flujo multi-paso con categorías específicas. Primer release: **Solo Productos** (Services en futuro).

---

## 📊 SCHEMA - Quote Collection

```typescript
interface Quote {
  _id: ObjectId;
  requestId: string; // QR-{tenantName}-{autoIncrement}
  tenantId: ObjectId;
  tenantName: string;
  userEmail: string;
  userName?: string;
  requestType: 'Comprar productos';
  products: ComputerItem[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ComputerItem {
  category: 'Computer';
  os?: 'macOS' | 'Windows' | 'Linux';
  quantity: number; // ✅ OBLIGATORIO
  brand?: string[];
  model?: string[];
  processor?: string[];
  ram?: string[];
  storage?: string[];
  screenSize?: string[];
  otherSpecifications?: string;
  extendedWarranty?: boolean;
  extendedWarrantyYears?: number; // ✅ Si extendedWarranty === true
  deviceEnrollment?: boolean;
  country: string; // ✅ OBLIGATORIO
  city?: string;
  deliveryDate?: Date;
  comments?: string;
}
```

---

## 🔄 FLUJO - 4 Steps (UX Frontend)

### **STEP 0: Tipo de Request**
- ✅ "Add Product" (activo)
- 🚫 "Add Service" (deshabilitado - futuro)

### **STEP 1: Selección de Categoría**
- ✅ **Computer** (clickeable - MVP)
- 🚫 Otras (deshabilitadas - futuro)

### **STEP 2a: Selección de OS**
- macOS, Windows, Linux, Skip

### **STEP 2b: Datos Específicos**
- Obligatorio: `quantity`
- Opcionales: Arrays de strings, checkboxes

### **STEP 3: Datos de Entrega**
- Obligatorio: `country`
- Opcionales: `city`, `deliveryDate`, `comments`

---

## ✅ VALIDACIONES - Zod Schema

```typescript
const ComputerItemSchema = z.object({
  category: z.literal('Computer'),
  os: z.enum(['macOS', 'Windows', 'Linux']).optional(),
  quantity: z.number().int().positive(),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  processor: z.array(z.string()).optional(),
  ram: z.array(z.string()).optional(),
  storage: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  otherSpecifications: z.string().optional(),
  extendedWarranty: z.boolean().optional(),
  extendedWarrantyYears: z.number().int().positive().optional(),
  deviceEnrollment: z.boolean().optional(),
  country: z.string().min(1),
  city: z.string().optional(),
  deliveryDate: z.date().optional(),
  comments: z.string().optional(),
}).refine(
  (data) => {
    if (data.extendedWarranty === true && !data.extendedWarrantyYears) {
      return false;
    }
    return true;
  },
  {
    message: 'extendedWarrantyYears es obligatorio si extendedWarranty es true',
    path: ['extendedWarrantyYears'],
  },
);

const CreateQuoteSchema = z.object({
  products: z.array(ComputerItemSchema).min(1),
});
```

---

## 🏗️ ARQUITECTURA - Servicios

### **Servicios Raíz**
- **`QuotesService`**: CRUD de quotes

### **Servicios Transversales**
- **`QuotesCoordinatorService`**: Coordinación Quotes + Slack + History

### **Integraciones**
- **`SlackService`**: Notificación a canal `#quotes`
- **`HistoryService`**: Auditoría de cambios

---

## 📝 NOTAS IMPORTANTES

- ✅ `quantity` y `country` son obligatorios
- ✅ Arrays pueden estar vacíos
- ✅ `extendedWarrantyYears` solo si `extendedWarranty === true`
- ✅ RequestId: `QR-{tenantName}-{autoIncrement}`
- ✅ Soft delete con flag `isDeleted`

