# 📋 QUOTES FEATURE - PLANIFICACIÓN COMPLETA

## 🎯 Resumen Ejecutivo

Feature de cotizaciones (presupuestos) para productos. Flujo multi-paso con categorías específicas. Primer release: **Solo Productos** (Services en futuro).

---

## 📊 SCHEMA - Quote Collection

```typescript
interface Quote {
  _id: ObjectId;
  requestId: string; // QR-{tenantName}-{autoIncrement}
  tenantId: ObjectId;
  tenantName: string; // Necesario para requestId único
  userEmail: string; // Del token
  userName?: string; // Del token
  requestType: 'Comprar productos';
  products: ProductData[]; // Array de múltiples productos
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Discriminated Union por categoría
type ProductData =
  | ComputerData
  | MonitorData
  | AudioData
  | PeripheralsData
  | MerchandisingData
  | OtherData;

// Datos comunes a todas las categorías (Pantalla 3)
interface DeliveryData {
  country: string;
  city: string;
  deliveryDate: Date;
  comments?: string;
}

// Computer (Pantalla 2a + 2b)
interface ComputerData extends DeliveryData {
  category: 'Computer';
  quantity: number; // ✅ ÚNICO OBLIGATORIO
  os?: 'macOS' | 'Windows' | 'Linux';
  brand?: string;
  model?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  screenSize?: string;
  otherSpecifications?: string;
  extendedWarranty?: boolean;
  deviceEnrollment?: boolean;
}

// Monitor, Audio, Peripherals (similar estructura)
interface MonitorData extends DeliveryData {
  category: 'Monitor';
  quantity: number; // ✅ ÚNICO OBLIGATORIO
  brand?: string;
  model?: string;
  screenSize?: string;
  resolution?: string;
  additionalInfo?: string;
}

// Merchandising (sin brand/model)
interface MerchandisingData extends DeliveryData {
  category: 'Merchandising';
  quantity: number; // ✅ ÚNICO OBLIGATORIO
  description?: string;
  additionalRequirements?: string;
}

// Other
interface OtherData extends DeliveryData {
  category: 'Other';
  quantity: number; // ✅ ÚNICO OBLIGATORIO
  description?: string;
  additionalInfo?: string;
}
```

---

## 🔄 FLUJO - 3 Pantallas

### **Pantalla 1: Seleccionar Categoría**

- 6 botones: Computer, Monitor, Audio, Peripherals, Merchandising, Other
- Botón "Add Product" para agregar más productos

### **Pantalla 2: Campos Específicos (Varía por Categoría)**

**Computer (Especial):**

- Pantalla 2a: OS Selection (macOS, Windows, Linux, Skip)
- Pantalla 2b: Quantity, Brand, Model, Processor, RAM, Storage, Screen Size, Other Specs, Checkboxes

**Otras Categorías:**

- Quantity, Brand, Model, + campos específicos
- Todos opcionales excepto Quantity

### **Pantalla 3: Datos de Entrega (Común)**

- Country (dropdown/texto)
- City (texto)
- Delivery Date (date picker)
- Comments (textarea)
- Botón "Save Product" → Vuelve a Pantalla 1
- Botón "Submit Request" → Envía Quote

---

## ✅ VALIDACIONES - Zod Schema

```typescript
// Validación discriminada por categoría
const QuoteProductSchema = z.discriminatedUnion('category', [
  ComputerDataSchema,
  MonitorDataSchema,
  AudioDataSchema,
  PeripheralsDataSchema,
  MerchandisingDataSchema,
  OtherDataSchema,
]);

// Reglas por categoría:
// - Quantity: SIEMPRE obligatorio
// - Otros campos: TODOS opcionales
// - DeliveryData: SIEMPRE obligatorio (country, city, deliveryDate)
// - Comments: Opcional
```

---

## 🏗️ ARQUITECTURA - Servicios

### **Servicios Raíz**

- **`QuotesService`**: CRUD de quotes en colección tenant

### **Servicios Transversales**

- **`QuotesCoordinatorService`**: Coordinación entre Quotes + Slack + History
  - Crear quote → Notificar Slack → Registrar en History

### **Servicios Helper**

- **`SlackService`**: Notificación a canal `#quotes`
- **`HistoryService`**: Auditoría de cambios

---

## 📧 INTEGRACIONES

### **Slack Notification**

- **Evento**: Quote creado
- **Canal**: `#quotes`
- **Datos**: requestId (con tenantName), usuario, productos, link
- **Manejo de errores**: No bloquea creación si Slack falla

### **History Tracking**

- **Evento**: Quote creado/actualizado/cancelado
- **Datos**: requestId, usuario, acción, timestamp

---

## 🚀 IMPLEMENTACIÓN - Fases

### **Fase 1: Modelos y Validación**

- [ ] Crear Quote schema en MongoDB
- [ ] Definir tipos TypeScript (discriminated union)
- [ ] Crear Zod schemas de validación

### **Fase 2: Servicios**

- [ ] Crear `QuotesService` (CRUD)
- [ ] Crear `QuotesCoordinatorService`
- [ ] Crear módulo `QuotesModule`

### **Fase 3: Endpoints**

- [ ] `POST /quotes` - Crear quote
- [ ] `GET /quotes` - Listar quotes del usuario
- [ ] `GET /quotes/:id` - Obtener quote
- [ ] `PATCH /quotes/:id` - Actualizar quote
- [ ] `DELETE /quotes/:id` - Cancelar quote (soft delete)

### **Fase 4: Integraciones**

- [ ] Slack notification en creación
- [ ] History tracking
- [ ] Manejo de errores

### **Fase 5: Testing**

- [ ] Unit tests para servicios
- [ ] Integration tests para endpoints
- [ ] E2E tests para flujos completos

---

## 📋 REQUERIMIENTOS TÉCNICOS

✅ **Multi-tenant**: Quotes en colección tenant-específica
✅ **Discriminated Union**: Validación por categoría
✅ **Zod Validation**: Schemas tipados
✅ **Slack Integration**: Notificaciones automáticas
✅ **History Tracking**: Auditoría de cambios
✅ **Soft Delete**: `isDeleted` flag
✅ **Auto-increment**: RequestId con contador por tenant
✅ **Transacciones**: Operaciones atómicas

---

## 🔐 SEGURIDAD Y VALIDACIONES

### **Validaciones Obligatorias**

- ✅ Quantity > 0
- ✅ Country válido (ISO code)
- ✅ Delivery date >= hoy
- ✅ Email del usuario del token
- ✅ TenantId del usuario del token
- ✅ Discriminated union por categoría

### **Restricciones**

- ✅ Usuario solo ve sus propios quotes
- ✅ SuperAdmin puede ver todos los quotes
- ✅ Soft delete (no eliminar físicamente)

---

## 📝 NOTAS IMPORTANTES

1. **RequestId único**: Incluye tenantName para evitar duplicados entre tenants
2. **Solo Quantity obligatorio**: Todos los demás campos son opcionales
3. **Múltiples productos**: Un Quote puede tener N productos
4. **Pantalla 2a especial**: Solo Computer tiene selección de OS
5. **Checkboxes**: Solo Computer tiene Extended Warranty + Device Enrollment
6. **Delivery data común**: Pantalla 3 es igual para todas las categorías

---

## 🎯 PRÓXIMOS PASOS

1. Crear Quote schema en MongoDB
2. Definir tipos TypeScript
3. Implementar Zod schemas
4. Crear QuotesService
5. Crear endpoints REST
6. Integrar Slack
7. Agregar History tracking
8. Testing completo
