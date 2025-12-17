# 📁 QUOTES - Estructura de Carpetas y Archivos

## 🏗️ Estructura Actual

```
src/quotes/
├── quotes.controller.ts          # Endpoints REST
├── quotes.module.ts              # Módulo NestJS
├── quotes.service.ts             # Servicio raíz (CRUD)
├── quotes-coordinator.service.ts # Servicio transversal
│
├── dto/
│   ├── index.ts
│   ├── create-quote.dto.ts
│   ├── update-quote.dto.ts
│   ├── quote-response.dto.ts
│   └── quote-table.dto.ts
│
├── schemas/
│   ├── index.ts
│   └── quote.schema.ts
│
├── validations/
│   ├── index.ts
│   ├── computer-item.zod.ts
│   ├── create-quote.zod.ts
│   └── update-quote.zod.ts
│
├── interfaces/
│   ├── index.ts
│   └── quote.interface.ts
│
└── docs/
    ├── API_TEST.md
    ├── PHASE2_COMPLETE.md
    ├── PLANNING.md
    ├── TYPES_AND_DTOS.md
    ├── ZOD_SCHEMAS.md
    └── FOLDER_STRUCTURE.md
```

---

## 📝 Descripción de Archivos

### **Archivos Principales**

| Archivo                         | Responsabilidad                   |
| ------------------------------- | --------------------------------- |
| `quotes.controller.ts`          | Endpoints REST (POST, GET, etc.)  |
| `quotes.module.ts`              | Configuración del módulo NestJS   |
| `quotes.service.ts`             | CRUD de quotes (servicio raíz)    |
| `quotes-coordinator.service.ts` | Coordinación Slack + History      |

### **DTOs**

| Archivo                 | Propósito                          |
| ----------------------- | ---------------------------------- |
| `create-quote.dto.ts`   | Validación de entrada              |
| `update-quote.dto.ts`   | Validación de actualización        |
| `quote-response.dto.ts` | Formato de respuesta               |
| `quote-table.dto.ts`    | Resumen para tabla                 |

### **Schemas**

| Archivo           | Propósito                  |
| ----------------- | -------------------------- |
| `quote.schema.ts` | Schema Mongoose para Quote |

### **Validaciones Zod**

| Archivo               | Propósito                    |
| --------------------- | ---------------------------- |
| `computer-item.zod.ts` | Validación de ComputerItem   |
| `create-quote.zod.ts` | Validación de creación       |
| `update-quote.zod.ts` | Validación de actualización  |

### **Interfaces TypeScript**

| Archivo              | Propósito           |
| -------------------- | ------------------- |
| `quote.interface.ts` | Interfaces TypeScript |

### **Documentación**

| Archivo              | Propósito                      |
| -------------------- | ------------------------------ |
| `API_TEST.md`        | Guía de testing con ejemplos   |
| `PHASE2_COMPLETE.md` | Resumen de Fase 2              |
| `PLANNING.md`        | Planificación del feature      |
| `TYPES_AND_DTOS.md`  | Tipos e interfaces             |
| `ZOD_SCHEMAS.md`     | Validaciones Zod               |

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
computer-item.zod.ts
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
@Module({
  imports: [
    MongooseModule.forFeature([...]),
    SlackModule,
    HistoryModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuotesCoordinatorService],
})
export class QuotesModule {}
```

### **Servicios Inyectados**

| Servicio                  | Módulo  | Responsabilidad          |
| ------------------------- | ------- | ------------------------ |
| `SlackService`            | slack   | Notificaciones a #quotes |
| `HistoryService`          | history | Auditoría de cambios     |
| `TenantConnectionService` | infra   | Conexión multi-tenant    |

---

## 📋 Próximos Pasos

- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Documentación Swagger
- [ ] Validación en Controller

