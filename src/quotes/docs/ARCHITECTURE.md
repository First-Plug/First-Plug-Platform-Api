# 🏗️ Arquitectura de Quotes - Respetando el ABC del Proyecto

## 📚 Patrón Arquitectónico

El proyecto sigue un patrón de **dos capas de servicios**:

### **1. Servicios Centrales (Troncales)**
Interactúan directamente con la base de datos. Solo CRUD.

**Ejemplos en el proyecto:**
- `ProductsService` - CRUD de productos
- `ShipmentsService` - CRUD de shipments
- `OfficesService` - CRUD de oficinas
- `MembersService` - CRUD de miembros
- **`QuotesService`** - CRUD de quotes ✅

### **2. Servicios Transversales (Transversales)**
Coordinan entre servicios centrales. Manejan lógica de negocio compleja.

**Ejemplos en el proyecto:**
- `LogisticsService` - Coordina Products + Shipments + Offices
- `AssignmentsService` - Coordina Members + Products + Shipments
- `ShipmentOfficeCoordinatorService` - Coordina Shipments + Offices
- **`QuotesCoordinatorService`** - Coordina Quotes + History + Slack ✅

---

## 🎯 Arquitectura de Quotes

### **QuotesService (Troncal)**
```typescript
// Solo CRUD
- create(dto, tenantId, tenantName, userEmail)
- findAll(tenantName, userEmail)
- findById(id, tenantName, userEmail)
- update(id, dto, tenantName, userEmail)
- delete(id, tenantName, userEmail)
- generateRequestId() // Helper privado
```

**Responsabilidades:**
- ✅ Crear/leer/actualizar/eliminar quotes
- ✅ Generar requestId único
- ✅ Interactuar con BD

**NO hace:**
- ❌ Notificar a Slack
- ❌ Registrar en History
- ❌ Coordinar con otros servicios

### **QuotesCoordinatorService (Transversal)**
```typescript
// Coordinación
- createQuoteWithCoordination()
- cancelQuoteWithCoordination()
- notifyQuoteCreatedToSlack() // Privado
- recordQuoteCreationInHistory() // Privado
```

**Responsabilidades:**
- ✅ Llamar a QuotesService.create()
- ✅ Notificar a Slack (no-blocking)
- ✅ Registrar en History
- ✅ Manejar errores de coordinación

**NO hace:**
- ❌ Interactuar directamente con BD
- ❌ Lógica de CRUD

---

## 📊 Flujo de Creación de Quote

```
Controller (QuotesController)
    ↓
    ├─→ Validar con Zod ✅
    ├─→ Extraer datos del usuario
    └─→ Llamar a QuotesCoordinatorService.createQuoteWithCoordination()
        ↓
        ├─→ QuotesService.create() [Troncal]
        │   └─→ BD: Crear quote
        │
        ├─→ SlackService.notify() [No-blocking]
        │   └─→ Notificar creación
        │
        └─→ HistoryService.create() [No-blocking]
            └─→ Registrar en History
```

---

## ✅ Respeto a la Arquitectura

| Aspecto | Cumple | Evidencia |
|---------|--------|-----------|
| **Servicios Troncales** | ✅ | QuotesService solo CRUD |
| **Servicios Transversales** | ✅ | QuotesCoordinatorService coordina |
| **Separación de responsabilidades** | ✅ | Cada servicio tiene un rol claro |
| **No-blocking para notificaciones** | ✅ | Slack y History son no-blocking |
| **Manejo de errores** | ✅ | Errores de coordinación no rompen flujo |
| **Reutilización de patrones** | ✅ | Mismo patrón que Shipments/Logistics |

---

## 🔄 Comparación con Otros Servicios

### **Shipments (Referencia)**
```
ShipmentsService (Troncal)
    ↓
ShipmentOfficeCoordinatorService (Transversal)
    ↓
OfficesService (Troncal)
```

### **Quotes (Nuestro Patrón)**
```
QuotesService (Troncal)
    ↓
QuotesCoordinatorService (Transversal)
    ↓
HistoryService (Troncal)
SlackService (Transversal)
```

---

## 📝 Conclusión

✅ **Quotes respeta completamente la arquitectura del proyecto**

- Servicios centrales (Troncales) para CRUD
- Servicios transversales para coordinación
- Separación clara de responsabilidades
- Patrones consistentes con el resto del proyecto

