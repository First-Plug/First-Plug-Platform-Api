# 📖 01 - Resumen Ejecutivo - Feature Quotes

## 🎯 Objetivo

Permitir que usuarios creen presupuestos (quotes) a través de un formulario flexible. Los presupuestos se envían automáticamente a Slack y el usuario puede verlos en una tabla.

## 📊 Scope MVP

### ✅ Incluido - Primer Release

- Crear presupuestos de **Productos** (Comprar productos)
- Campos: Category, Brand, Model, Quantity, Additional Info, Priority
- Información de entrega: City, Country, Date
- Enviar notificación a Slack automáticamente
- Listar presupuestos del usuario
- Ver detalles de un presupuesto específico
- Soft delete de presupuestos

### ❌ NO Incluido - Futuras Fases

- Otros tipos de solicitud: Logística, Servicio técnico, Recompra de equipos, Asesoramiento
- Estados de presupuesto
- Acciones sobre presupuestos (editar, aprobar, rechazar)
- Cálculo de precios
- Validación de productos específicos

## 🏗️ Arquitectura

### Servicios

- **QuotesService** (ROOT): CRUD de quotes
- **QuotesCoordinatorService** (TRANSVERSAL): Coordina con Slack y History

### Dependencias

- SlackService (notificaciones)
- HistoryService (auditoría)
- TenantConnectionService (multi-tenant)

## 📦 Schema - Primer Release (Solo Productos)

```typescript
interface Quote {
  _id: ObjectId;

  // === IDENTIFICACIÓN ===
  requestID: string; // QR-2025-001 (generado automáticamente)

  // === TENANT ===
  tenantId: ObjectId;
  tenantName?: string;

  // === USUARIO ===
  userEmail: string;
  userName?: string;
  userPhone?: string;

  // === SOLICITUD ===
  requestType: 'Producto'; // Solo Producto en primer release
  requestData: ProductoData;

  // === PRIORIDAD ===
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // === AUDITORÍA ===
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductoData {
  items: Array<{
    category:
      | 'Computer'
      | 'Audio'
      | 'Monitor'
      | 'Peripherals'
      | 'Merchandising'
      | 'Other';
    brand: string;
    model: string;
    quantity: number;
    additionalInfo?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryDate: string;
  comments?: string;
}
```

**Características**:

- ✅ Validación fuerte con TypeScript
- ✅ Campos específicos para productos
- ✅ Brand y Model en lugar de Product Name
- ✅ Additional Info para detalles libres
- ✅ Zod puede validar según el tipo
- ✅ Frontend sabe exactamente qué pedir
- ✅ Slack recibe datos estructurados

## 👤 Información del Usuario

La información del usuario se obtiene automáticamente del token/session:

- **userEmail**: Del token JWT
- **userName**: Del token JWT
- **userPhone**: Del token JWT - - De ser necesario hay que agregarlo en el token
- **tenantId**: Del token JWT
- **tenantName**: Del token JWT

**El usuario NO completa estos campos en el formulario.** Se envían automáticamente en el payload del POST.

---

## 🔌 Endpoints (MVP)

| Método | Endpoint      | Descripción                     |
| ------ | ------------- | ------------------------------- |
| POST   | `/quotes`     | Crear presupuesto               |
| GET    | `/quotes`     | Listar presupuestos del usuario |
| GET    | `/quotes/:id` | Obtener presupuesto específico  |

## 🔔 Notificación Slack

**Canal**: `#quotes`

**Contenido**:

- Email del usuario
- Tipo de solicitud
- Detalles de la solicitud
- Link para revisar en el sistema

## 📁 Estructura de Carpetas

```
src/quotes/
├── schemas/quote.schema.ts
├── dto/create-quote.dto.ts
├── interfaces/quote.interface.ts
├── services/quotes.service.ts
├── services/quotes-coordinator.service.ts
├── controllers/quotes.controller.ts
└── quotes.module.ts
```

---

**Próximo paso**: Lee 02_QUOTES_FORM_ANALYSIS.md
