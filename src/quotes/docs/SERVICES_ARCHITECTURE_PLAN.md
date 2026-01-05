# 📋 Plan: Servicios en Quotes - Arquitectura y Diseño

## 🎯 Objetivo

Agregar soporte para servicios (IT Support, etc.) a quotes sin romper la arquitectura existente.

---

## 📊 Flujo del Usuario (Frontend)

1. **Agregar Servicio** → Click en "Add Service"
2. **Seleccionar Categoría** → Solo "IT Support" habilitado por ahora
3. **Seleccionar Producto** → Ver cards con datos + asignado + serial number
4. **Seleccionar Issues** → Array de issues (min 1 requerido)
   - Software issue
   - Connectivity / network
   - Account / access issue
   - Performance issues
   - Damage / accident
   - Other
5. **Detalles del Servicio** → Description (required), issueStartDate (optional), impactLevel (required: low/medium/high)
6. **Review** → Ver detalles completados
7. **Submit Request** → Servicio se suma a quote, puede agregar más servicios/productos

---

## 🏗️ Estructura de Datos

### Service Schema (Subdocumento)

```typescript
@Schema({ _id: false })
export class ServiceItemSchema {
  @Prop({ type: String, enum: ['IT Support'], required: true })
  serviceCategory: 'IT Support';

  // Referencia al producto que se repara/soporta
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId; // ID del producto en warehouse

  @Prop({ type: Object })
  productSnapshot?: {
    // Snapshot del producto: nombre, serial, ubicación, asignado a
    serialNumber?: string;
    location?: string; // Employee/FP warehouse/Our office
    assignedTo?: string; // member/office/warehouse
  };

  // Issues
  @Prop({ type: [String], required: true })
  issues: string[]; // Array de issues seleccionados

  // Detalles
  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String })
  issueStartDate?: string; // YYYY-MM-DD format

  @Prop({ type: String, enum: ['low', 'medium', 'high'], required: true })
  impactLevel: 'low' | 'medium' | 'high';
}
```

### Quote Schema - Cambios

```typescript
@Prop({ type: String, required: true, enum: ['Comprar productos', 'Solicitar servicio', 'Mixto'] })
requestType: 'Comprar productos' | 'Solicitar servicio' | 'Mixto';

@Prop({
  type: [ServiceItemSchema],
  required: true,
  default: [],
})
services: ServiceItemSchema[];
```

---

## 🔄 Lógica de requestType

| Caso                  | requestType            |
| --------------------- | ---------------------- |
| Solo productos        | `'Comprar productos'`  |
| Solo servicios        | `'Solicitar servicio'` |
| Productos + Servicios | `'Mixto'`              |

---

## 🎯 Decisiones de Arquitectura

### 1. Referencia de Producto

**Opción elegida: ID + Snapshot**

- Guardar `productId` para auditoría/trazabilidad
- Guardar `productSnapshot` para no depender de cambios en warehouse
- Evita acoplamiento fuerte con ProductsService

### 2. Modularización

- **Servicios como subdocumento** en Quote (no colección separada)
- Mantiene Quote como entidad atómica
- Simplifica transacciones y consistencia

### 3. Validación

- Usar Zod para validar servicios
- Discriminated union: `ServiceItem` (solo IT Support por ahora)
- Extensible para futuras categorías

### 4. History & Slack

- Registrar servicios en history igual que productos
- Enviar a Slack con formato similar a productos
- Incluir issues, description, impactLevel

---

## 📁 Archivos a Crear/Modificar

### Crear

- `src/quotes/schemas/service.schema.ts` - Service schemas
- `src/quotes/interfaces/service.interface.ts` - Service interfaces
- `src/quotes/validations/service.zod.ts` - Service validations
- `src/quotes/dto/service.dto.ts` - Service DTOs

### Modificar

- `src/quotes/schemas/quote.schema.ts` - Agregar services array, cambiar requestType
- `src/quotes/interfaces/quote.interface.ts` - Actualizar Quote interface
- `src/quotes/validations/create-quote.zod.ts` - Permitir servicios
- `src/quotes/quotes.service.ts` - Lógica para servicios
- `src/quotes/quotes-coordinator.service.ts` - History & Slack
- `src/quotes/quotes.controller.ts` - Endpoints para servicios

---

## ✅ Reglas de Oro (Arquitectura)

1. **No acoplar servicios** - Usar IDs + snapshots, no referencias directas
2. **Modularizar** - Servicios como subdocumento, no colección
3. **Validación centralizada** - Zod para todo
4. **History & Auditoría** - Registrar todo en history
5. **Slack notifications** - Notificar cambios importantes
6. **Soft delete** - Mantener patrón existente

---

## 🎁 Donate Service

### Descripción

Servicio para solicitar donación de múltiples productos. Permite capturar información sobre qué productos se donarán, si necesitan data wipe (solo para Computer/Other), si necesitan limpieza, y comentarios adicionales.

### Flujo del Usuario (Frontend)

1. **Seleccionar Categoría** → "Donate"
2. **Seleccionar Productos** → Múltiples productos (min 1 requerido)
3. **Por cada Producto:**
   - Si categoría es Computer o Other: ¿Necesita data wipe? (Yes/No)
   - ¿Necesita limpieza? (Yes/No)
   - Comentarios opcionales
4. **Detalles Adicionales** → Información general sobre la donación (opcional)
5. **Submit** → Se crea el servicio Donate en la quote

### Estructura de Datos

```typescript
@Schema({ _id: false })
export class DonateProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: Boolean })
  needsDataWipe?: boolean; // Solo si category es Computer o Other

  @Prop({ type: Boolean })
  needsCleaning?: boolean;

  @Prop({ type: String })
  comments?: string;
}

@Schema({ _id: false })
export class DonateServiceSchema {
  @Prop({ type: String, enum: ['Donate'], required: true })
  serviceCategory: 'Donate';

  @Prop({ type: [DonateProductSchema], required: true })
  products: DonateProductSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}
```

### Validación Zod

- `serviceCategory`: Literal 'Donate'
- `products`: Array min 1, cada producto con:
  - `productId`: Optional string (MongoDB ObjectId)
  - `productSnapshot`: Optional ProductSnapshot
  - `needsDataWipe`: Optional boolean (solo si category es Computer o Other)
  - `needsCleaning`: Optional boolean
  - `comments`: Optional string max 1000 chars
- `additionalDetails`: Optional string max 1000 chars

### Mensaje Slack

Muestra:

- Total de assets a donar
- Para cada producto:
  - Categoría
  - Brand + Model + Name
  - Serial Number
  - Location + Country
  - Needs Data Wipe (si aplica)
  - Needs Cleaning
  - Comments (si existen)
- Additional details (si existen)

### History Recording

Se registra con:

- `serviceCategory`: 'Donate'
- `productCount`: Cantidad de productos
- `products`: Array con:
  - `productSnapshot`: Datos del producto
  - `productId`: ID del producto
  - `needsDataWipe`: Boolean (si aplica)
  - `needsCleaning`: Boolean
  - `comments`: String (si existen)
- `additionalDetails`: String (si existe)

---

## 🚀 Próximos Pasos

1. Crear schemas y interfaces para servicios ✅
2. Actualizar Quote schema ✅
3. Crear validaciones Zod ✅
4. Crear DTOs ✅
5. Actualizar QuotesService ✅
6. Actualizar QuotesCoordinatorService ✅
7. Actualizar endpoints ✅
8. Testing
