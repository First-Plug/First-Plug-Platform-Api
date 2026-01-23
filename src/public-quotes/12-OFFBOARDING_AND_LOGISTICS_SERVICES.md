# 🚚 Offboarding y Logistics Services - Public Quotes

## 📋 Resumen

Se han agregado dos nuevos servicios a Public Quotes:
- **Offboarding**: Gestión de devolución de equipos al terminar relación laboral
- **Logistics**: Cotización de envíos de productos a diferentes destinos

Ambos servicios están disponibles para clientes potenciales sin productos pre-cargados.

---

## 🔄 Offboarding Service

### Descripción
Permite solicitar la devolución y gestión de equipos de un miembro que está siendo desvinculado.

### Estructura de Datos

```typescript
{
  serviceCategory: 'Offboarding',
  originMember: {
    firstName: string,        // Nombre del miembro
    lastName: string,         // Apellido del miembro
    email: string,           // Email del miembro
    countryCode: string      // Código ISO (AR, BR, US, etc.)
  },
  isSensitiveSituation: boolean,  // ¿Es situación sensible?
  employeeKnows: boolean,         // ¿El empleado sabe?
  products: [{
    productId?: string,           // ID del producto (opcional)
    productSnapshot?: {...},      // Snapshot del producto
    destination: {
      type: 'Member' | 'Office' | 'Warehouse',
      // Campos según tipo de destino
      memberId?: string,
      assignedMember?: string,
      assignedEmail?: string,
      officeId?: string,
      officeName?: string,
      warehouseId?: string,
      warehouseName?: string,
      countryCode: string
    }
  }],
  desirablePickupDate?: string,   // YYYY-MM-DD
  additionalDetails?: string      // Comentarios (max 1000 chars)
}
```

### Campos Requeridos
- ✅ serviceCategory: 'Offboarding'
- ✅ originMember (completo)
- ✅ isSensitiveSituation
- ✅ employeeKnows
- ✅ products (mínimo 1)

### Campos Opcionales
- ❌ productId (puede ser null)
- ❌ desirablePickupDate
- ❌ additionalDetails

---

## 🚚 Logistics Service

### Descripción
Permite solicitar cotización de envío de productos desde su ubicación actual a un destino.

### Estructura de Datos

```typescript
{
  serviceCategory: 'Logistics',
  products: [{
    productId?: string,           // ID del producto (opcional)
    productSnapshot?: {...},      // Snapshot del producto
    destination: {
      type: 'Member' | 'Office' | 'Warehouse',
      // Campos según tipo de destino
      memberId?: string,
      assignedMember?: string,
      assignedEmail?: string,
      officeId?: string,
      officeName?: string,
      warehouseId?: string,
      warehouseName?: string,
      countryCode: string (REQUERIDO)
    }
  }],
  desirablePickupDate?: string,   // YYYY-MM-DD
  additionalDetails?: string      // Comentarios (max 1000 chars)
}
```

### Campos Requeridos
- ✅ serviceCategory: 'Logistics'
- ✅ products (mínimo 1)
- ✅ destination.type
- ✅ destination.countryCode

### Campos Opcionales
- ❌ productId (puede ser null)
- ❌ desirablePickupDate
- ❌ additionalDetails

---

## 🎯 Diferencias Clave

| Aspecto | Offboarding | Logistics |
|---------|-------------|-----------|
| **Propósito** | Devolución de equipos | Envío de productos |
| **Requiere Miembro** | ✅ Sí (originMember) | ❌ No |
| **Sensibilidad** | ✅ isSensitiveSituation | ❌ No |
| **Conocimiento Empleado** | ✅ employeeKnows | ❌ No |
| **Destinos** | Member/Office/Warehouse | Member/Office/Warehouse |
| **Productos** | Mínimo 1 | Mínimo 1 |

---

## 📝 Validaciones Zod

### Offboarding
```typescript
- originMember: requerido (firstName, lastName, email, countryCode)
- isSensitiveSituation: boolean requerido
- employeeKnows: boolean requerido
- products: array mínimo 1
- desirablePickupDate: YYYY-MM-DD (opcional)
- additionalDetails: max 1000 chars (opcional)
```

### Logistics
```typescript
- products: array mínimo 1
- destination.type: 'Member' | 'Office' | 'Warehouse'
- destination.countryCode: requerido
- desirablePickupDate: YYYY-MM-DD (opcional)
- additionalDetails: max 1000 chars (opcional)
```

---

## 🔐 Consideraciones de Seguridad

### Para Public Quotes
- ✅ Sin validación de IDs internos (memberId, officeId, warehouseId)
- ✅ Aceptar datos como strings sin validar existencia
- ✅ Validar formato de datos (emails, códigos país)
- ✅ Limitar tamaño de campos (max 1000 chars)
- ✅ Rate limiting: 10 req/min por IP

### Datos Sensibles
- ❌ NO validar que memberId existe
- ❌ NO validar que officeId existe
- ❌ NO validar que warehouseId existe
- ✅ Guardar como strings en BD

---

## 📚 Próximos Pasos

1. Actualizar validación Zod en `create-public-quote.zod.ts`
2. Actualizar DTO para incluir Offboarding y Logistics
3. Actualizar ejemplos de código
4. Actualizar roadmap de implementación
5. Crear tests para ambos servicios

