# 🔧 Offboarding Service - Backend

## 📌 ¿Qué Necesita Hacer el Backend?

Implementar el **Offboarding Service** en la arquitectura de servicios existente.

---

## 📊 Estructura de Datos

```typescript
OffboardingService {
  serviceCategory: 'Offboarding'
  originMember: {
    memberId: ObjectId
    firstName: string
    lastName: string
    email: string
    countryCode: string (max 2)
  }
  isSensitiveSituation: boolean (REQUIRED)
  employeeKnows: boolean (REQUIRED)
  products: [{
    productId: string (optional)
    productSnapshot: ProductSnapshotSchema
    destination: {
      type: 'Member' | 'Office' | 'Warehouse'
      // Si type='Member':
      memberId: ObjectId
      assignedMember: string
      assignedEmail: string
      countryCode: string
      // Si type='Office':
      officeId: ObjectId
      officeName: string
      countryCode: string
      // Si type='Warehouse':
      warehouseId: ObjectId
      warehouseName: string
      countryCode: string
    }
  }]
  additionalDetails: string (optional, max 1000)
}
```

---

## 📋 Tareas de Implementación

### FASE 1: Schemas (service.schema.ts)

- [ ] Crear `OffboardingDestinationSchema` (discriminated union: Member/Office/Warehouse)
- [ ] Crear `OffboardingOriginMemberSchema`
- [ ] Crear `OffboardingProductSchema`
- [ ] Crear `OffboardingServiceSchema`

### FASE 2: Interfaces (service.interface.ts)

- [ ] Crear `OffboardingDestination` (union type)
- [ ] Crear `OffboardingOriginMember`
- [ ] Crear `OffboardingProduct`
- [ ] Crear `OffboardingService`
- [ ] Actualizar `ServiceData` union

### FASE 3: Validaciones Zod (service.zod.ts)

- [ ] Crear `OffboardingDestinationSchema` (discriminated union)
- [ ] Crear `OffboardingOriginMemberSchema`
- [ ] Crear `OffboardingProductSchema`
- [ ] Crear `OffboardingServiceSchema`
- [ ] Actualizar `ServiceUnion`

### FASE 4: DTOs (service.dto.ts)

- [ ] Crear `OffboardingServiceResponseDto`
- [ ] Actualizar `ServiceResponseDto` union

### FASE 5: Quote Schema (quote.schema.ts)

- [ ] Importar `OffboardingServiceSchema`
- [ ] Agregar al array de servicios en `@Prop`

### FASE 6: Slack Messages (create-quote-message-to-slack.ts)

- [ ] Agregar `else if` para `serviceCategory === 'Offboarding'`
- [ ] Mostrar `originMember` (nombre, email, país)
- [ ] Mostrar `isSensitiveSituation` (Sí/No)
- [ ] Mostrar `employeeKnows` (Sí/No)
- [ ] Mostrar total de productos
- [ ] Para cada producto:
  - [ ] Mostrar datos del producto (category, brand, model, serial)
  - [ ] Mostrar location actual (Employee + nombre + país)
  - [ ] Mostrar destino (tipo + nombre + país)
- [ ] Mostrar `additionalDetails`

### FASE 7: History Recording (quotes-coordinator.service.ts)

- [ ] Agregar `else if` para `serviceCategory === 'Offboarding'`
- [ ] Registrar `originMember`
- [ ] Registrar `isSensitiveSituation`
- [ ] Registrar `employeeKnows`
- [ ] Registrar `productCount`
- [ ] Para cada producto:
  - [ ] Registrar `productSnapshot`
  - [ ] Registrar `destination`
- [ ] Registrar `additionalDetails`

### FASE 8: Documentación (PAYLOAD_EXAMPLES_MULTI_CATEGORY.md)

- [ ] Agregar Example: Offboarding Simple (1 producto a Member)
- [ ] Agregar Example: Offboarding Múltiple (productos a diferentes destinos)
- [ ] Agregar Example: Offboarding Internacional (cambio de país)

---

## ✅ Validaciones Críticas

1. ✓ isSensitiveSituation: boolean (REQUIRED)
2. ✓ employeeKnows: boolean (REQUIRED)
3. ✓ Mínimo 1 producto
4. ✓ Destino válido (Member/Office/Warehouse)
5. ✓ Si destino=Member: email debe existir
6. ✓ Si destino=Office: officeId debe existir
7. ✓ Si destino=Warehouse: usar warehouse del país origen
8. ✓ Country code siempre presente

---

## 📤 Payload Esperado del Frontend

```json
{
  "serviceCategory": "Offboarding",
  "originMember": {
    "memberId": "...",
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "countryCode": "..."
  },
  "isSensitiveSituation": true,
  "employeeKnows": false,
  "products": [
    {
      "productId": "...",
      "productSnapshot": {
        /* datos actuales */
      },
      "destination": {
        "type": "Member|Office|Warehouse"
        /* datos específicos según tipo */
      }
    }
  ],
  "additionalDetails": "..."
}
```

---

## 🔄 Diferencias vs Otros Servicios

| Aspecto                | Otros Servicios | Offboarding               |
| ---------------------- | --------------- | ------------------------- |
| Selección de productos | Manual          | **Automática**            |
| Requiere member        | No              | **Sí**                    |
| Destino                | N/A             | **Variable por producto** |
| Validaciones           | Simples         | **Complejas**             |

---

## 📊 Resumen de Cambios

| Archivo                            | Cambios             |
| ---------------------------------- | ------------------- |
| service.schema.ts                  | +4 schemas          |
| service.interface.ts               | +4 interfaces       |
| service.zod.ts                     | +4 schemas zod      |
| service.dto.ts                     | +1 DTO              |
| quote.schema.ts                    | +1 import, +1 línea |
| create-quote-message-to-slack.ts   | +1 bloque else if   |
| quotes-coordinator.service.ts      | +1 bloque else if   |
| PAYLOAD_EXAMPLES_MULTI_CATEGORY.md | +3 ejemplos         |

---

## ⏱️ Tiempo Estimado

- **Implementación**: 2-3 horas
- **Testing**: 1 hora
- **Total**: 3-4 horas

---

## 🎯 Orden de Implementación Recomendado

1. Schemas (service.schema.ts)
2. Interfaces (service.interface.ts)
3. Validaciones (service.zod.ts)
4. DTOs (service.dto.ts)
5. Quote Schema (quote.schema.ts)
6. Slack Messages (create-quote-message-to-slack.ts)
7. History Recording (quotes-coordinator.service.ts)
8. Documentación (PAYLOAD_EXAMPLES_MULTI_CATEGORY.md)
