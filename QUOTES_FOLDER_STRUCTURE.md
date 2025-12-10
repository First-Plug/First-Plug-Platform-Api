# 📁 QUOTES - Estructura de Carpetas y Archivos

## 🏗️ Estructura Propuesta

```
src/quotes/
├── quotes.controller.ts          # Endpoints REST
├── quotes.module.ts              # Módulo NestJS
├── quotes.service.ts             # Servicio raíz (CRUD)
├── quotes-coordinator.service.ts # Servicio transversal (Slack + History)
│
├── dto/
│   ├── index.ts
│   ├── create-quote.dto.ts       # DTO para crear quote
│   ├── update-quote.dto.ts       # DTO para actualizar quote
│   └── quote-response.dto.ts     # DTO para respuesta
│
├── schemas/
│   ├── quote.schema.ts           # Mongoose schema
│   └── quote-product.schema.ts   # Subdocumento ProductData
│
├── validations/
│   ├── create-quote.zod.ts       # Zod schema para creación
│   ├── update-quote.zod.ts       # Zod schema para actualización
│   └── product-data.zod.ts       # Zod discriminated union
│
├── interfaces/
│   ├── quote.interface.ts        # Interfaces TypeScript
│   ├── product-data.interface.ts # ProductData discriminated union
│   └── delivery-data.interface.ts # DeliveryData común
│
├── helpers/
│   ├── request-id.helper.ts      # Generación de requestId
│   ├── product-validator.helper.ts # Validación por categoría
│   └── quote-mapper.helper.ts    # Mapeo de datos
│
├── listeners/
│   └── quote-created.listener.ts # Event listener (si se usa)
│
└── __tests__/
    ├── quotes.service.spec.ts
    ├── quotes.controller.spec.ts
    └── quotes-coordinator.spec.ts
```

---

## 📝 Descripción de Archivos

### **Archivos Principales**

| Archivo                         | Responsabilidad                            |
| ------------------------------- | ------------------------------------------ |
| `quotes.controller.ts`          | Endpoints REST (POST, GET, PATCH, DELETE)  |
| `quotes.module.ts`              | Configuración del módulo NestJS            |
| `quotes.service.ts`             | CRUD de quotes (servicio raíz)             |
| `quotes-coordinator.service.ts` | Coordinación Slack + History (transversal) |

### **DTOs**

| Archivo                 | Propósito                                   |
| ----------------------- | ------------------------------------------- |
| `create-quote.dto.ts`   | Validación de entrada para crear quote      |
| `update-quote.dto.ts`   | Validación de entrada para actualizar quote |
| `quote-response.dto.ts` | Formato de respuesta al cliente             |

### **Schemas**

| Archivo                   | Propósito                              |
| ------------------------- | -------------------------------------- |
| `quote.schema.ts`         | Schema Mongoose para Quote             |
| `quote-product.schema.ts` | Schema para ProductData (subdocumento) |

### **Validaciones Zod**

| Archivo               | Propósito                          |
| --------------------- | ---------------------------------- |
| `create-quote.zod.ts` | Validación Zod para creación       |
| `update-quote.zod.ts` | Validación Zod para actualización  |
| `product-data.zod.ts` | Discriminated union (6 categorías) |

### **Interfaces TypeScript**

| Archivo                      | Propósito                       |
| ---------------------------- | ------------------------------- |
| `quote.interface.ts`         | Interface Quote                 |
| `product-data.interface.ts`  | Discriminated union ProductData |
| `delivery-data.interface.ts` | Interface DeliveryData común    |

### **Helpers**

| Archivo                       | Propósito                                           |
| ----------------------------- | --------------------------------------------------- |
| `request-id.helper.ts`        | Generar requestId único (QR-{tenantName}-{counter}) |
| `product-validator.helper.ts` | Validar campos por categoría                        |
| `quote-mapper.helper.ts`      | Mapear datos entre DTOs e interfaces                |

---

## 🔄 Relaciones Entre Archivos

```
quotes.controller.ts
    ↓
quotes.service.ts (CRUD)
    ↓
quotes-coordinator.service.ts (Slack + History)
    ↓
SlackService + HistoryService

Validación:
    ↓
product-data.zod.ts (Discriminated union)
    ↓
create-quote.zod.ts
    ↓
quotes.controller.ts

Datos:
    ↓
quote.schema.ts (Mongoose)
    ↓
quote.interface.ts (TypeScript)
    ↓
create-quote.dto.ts (Entrada)
    ↓
quote-response.dto.ts (Salida)
```

---

## 🔗 Integración con Otros Módulos

### **Dependencias Externas**

```typescript
// En quotes.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([...]),
    SlackModule,           // Para notificaciones
    HistoryModule,         // Para auditoría
    TenantConnectionModule, // Para multi-tenant
  ],
  controllers: [QuotesController],
  providers: [
    QuotesService,         // Servicio raíz
    QuotesCoordinatorService, // Transversal
  ],
})
export class QuotesModule {}
```

### **Servicios Inyectados**

| Servicio                  | Módulo  | Responsabilidad          |
| ------------------------- | ------- | ------------------------ |
| `SlackService`            | slack   | Notificaciones a #quotes |
| `HistoryService`          | history | Auditoría de cambios     |
| `TenantConnectionService` | infra   | Conexión multi-tenant    |

### **Patrón de Arquitectura**

```
QuotesController
    ↓
QuotesService (Raíz - CRUD)
    ↓
QuotesCoordinatorService (Transversal)
    ↓
SlackService + HistoryService
```

---

## 📋 Checklist de Creación

- [ ] `quotes.controller.ts` - Endpoints REST
- [ ] `quotes.module.ts` - Módulo NestJS
- [ ] `quotes.service.ts` - Servicio CRUD
- [ ] `quotes-coordinator.service.ts` - Coordinador
- [ ] `dto/create-quote.dto.ts`
- [ ] `dto/update-quote.dto.ts`
- [ ] `dto/quote-response.dto.ts`
- [ ] `schemas/quote.schema.ts`
- [ ] `schemas/quote-product.schema.ts`
- [ ] `validations/product-data.zod.ts`
- [ ] `validations/create-quote.zod.ts`
- [ ] `validations/update-quote.zod.ts`
- [ ] `interfaces/quote.interface.ts`
- [ ] `interfaces/product-data.interface.ts`
- [ ] `interfaces/delivery-data.interface.ts`
- [ ] `helpers/request-id.helper.ts`
- [ ] `helpers/product-validator.helper.ts`
- [ ] `helpers/quote-mapper.helper.ts`
- [ ] Tests unitarios
- [ ] Tests de integración
