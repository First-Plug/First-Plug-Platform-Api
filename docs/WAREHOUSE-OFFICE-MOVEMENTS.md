# Warehouse ↔ Office Movements Implementation

## 📋 Resumen

Se implementó la funcionalidad para permitir movimientos directos de productos entre **FP warehouse** y **Our office**, completando los flujos de movimiento que faltaban en el sistema.

## 🎯 Funcionalidades Implementadas

### 1. Movimientos Soportados

| Origen | Destino | ActionType | Estado |
|--------|---------|------------|--------|
| FP warehouse | Our office | `assign`, `reassign` | ✅ Implementado |
| Our office | FP warehouse | `assign`, `reassign` | ✅ Implementado |
| FP warehouse | Employee | `assign`, `reassign` | ✅ Ya existía |
| Our office | Employee | `assign`, `reassign` | ✅ Ya existía |
| Employee | FP warehouse | `return`, `relocate` | ✅ Ya existía |
| Employee | Our office | `return`, `relocate` | ✅ Ya existía |

### 2. Limpieza de Objetos de Ubicación

Se implementó el método `handleLocationObjectCleanup()` que maneja automáticamente:

- **Warehouse → Office**: Limpia `fpWarehouse` y crea `office`
- **Office → Warehouse**: Limpia `office` y crea `fpWarehouse`  
- **Warehouse/Office → Employee**: Limpia ambos objetos

### 3. Preservación de lastAssigned

El sistema preserva correctamente la ubicación anterior:

- **Desde Warehouse**: `"FP warehouse - AR - Warehouse Name"`
- **Desde Office**: `"Our office - AR - Office Name"`
- **Desde Employee**: Email del empleado

## 🔧 Cambios Técnicos Realizados

### AssignmentsService (`src/assignments/assignments.service.ts`)

#### Nuevo Método: `handleLocationObjectCleanup()`

```typescript
private handleLocationObjectCleanup(
  newLocation: string | undefined,
  currentProduct: any,
): { fpWarehouse?: null; office?: null }
```

**Funcionalidad:**
- Detecta movimientos entre ubicaciones
- Limpia objetos `fpWarehouse` y `office` según corresponda
- Registra logs detallados de las operaciones

#### Modificaciones en Métodos Existentes

1. **`handleUnknownEmailUpdate()`**
   - Agregado cleanup de objetos de ubicación
   - Líneas 995-1000

2. **`moveToProductsCollection()`**
   - Agregado cleanup en la creación del producto
   - Línea 1331

3. **`moveToMemberCollection()`**
   - Agregado cleanup cuando se mueve a Employee
   - Línea 1220

4. **`handleProductFromProductsCollection()`**
   - Agregado cleanup después de asignaciones warehouse/office
   - Líneas 2015-2025

### Validaciones y DTOs

✅ **No se requirieron cambios** - Las validaciones existentes ya soportan:
- `actionType: ['assign', 'reassign']` para movimientos warehouse↔office
- `location: ['FP warehouse', 'Our office']` con `actionType` presente
- Validación de `status: 'Available'` con ubicaciones warehouse/office

### Sincronización Global

✅ **No se requirieron cambios** - `GlobalProductSyncService` ya maneja:
- Preservación de objetos `fpWarehouse` y `office`
- Cálculo correcto de `lastAssigned`
- Campos calculados (`inFpWarehouse`, `isAssigned`)

### LastAssignedHelper

✅ **No se requirieron cambios** - Ya tenía soporte completo para:
- Movimientos warehouse↔office
- Formateo correcto de ubicaciones
- Preservación de información anterior

## 🧪 Testing

### Test de Integración

**Archivo:** `src/test/integration/warehouse-office-movements.integration.spec.ts`

**Casos probados:**
- ✅ Movimiento Office → Warehouse
- ✅ Movimiento Warehouse → Office  
- ✅ Múltiples movimientos consecutivos
- ✅ Limpieza correcta de objetos
- ✅ Preservación de `lastAssigned`
- ✅ Validación de errores
- ✅ Sincronización global

### Script de Prueba Manual

**Archivo:** `scripts/test-warehouse-office-movements.ts`

**Uso:**
```bash
npx ts-node scripts/test-warehouse-office-movements.ts
```

**Funcionalidades probadas:**
- Creación de oficina y producto
- Movimientos bidireccionales
- Verificación de estado de objetos
- Cleanup automático

## 📊 Flujo de Datos

### Antes (Limitado)
```
Employee ←→ FP warehouse
Employee ←→ Our office
```

### Después (Completo)
```
Employee ←→ FP warehouse ←→ Our office
```

## 🔍 Puntos Clave de la Implementación

### 1. Detección de Movimientos

El sistema detecta automáticamente el tipo de movimiento basado en:
- `currentProduct.location` (ubicación actual)
- `newLocation` (ubicación destino)
- Presencia de objetos `fpWarehouse` y `office`

### 2. Limpieza Inteligente

```typescript
// Ejemplo: Warehouse → Office
if (
  currentProduct.fpWarehouse &&
  currentProduct.location === 'FP warehouse' &&
  newLocation === 'Our office'
) {
  cleanupFields.fpWarehouse = null; // Limpiar warehouse
}
```

### 3. Preservación de Datos

- **lastAssigned**: Se calcula usando `LastAssignedHelper`
- **Objetos de ubicación**: Se preservan hasta el momento del movimiento
- **Metadatos**: `assignedAt`, `status`, etc. se mantienen consistentes

## 🚀 Uso en Producción

### Endpoints Afectados

- `PUT /products/:id` - Actualización de productos
- `POST /products/bulk-update` - Actualización masiva
- `PUT /products/:id/assign` - Asignación específica

### Parámetros Requeridos

**Para Warehouse → Office:**
```json
{
  "location": "Our office",
  "actionType": "reassign",
  "assignedEmail": "none",
  "officeId": "office-id-here", // Opcional, usa default si no se proporciona
  "status": "Available"
}
```

**Para Office → Warehouse:**
```json
{
  "location": "FP warehouse", 
  "actionType": "reassign",
  "assignedEmail": "none",
  "status": "Available"
}
```

## ⚠️ Consideraciones Importantes

1. **ActionType Requerido**: Los movimientos warehouse↔office solo funcionan con `assign` o `reassign`
2. **Status Consistency**: El status debe ser `Available` para ubicaciones warehouse/office
3. **Office Default**: Si no se proporciona `officeId`, se usa la oficina default del tenant
4. **Transacciones**: Todos los movimientos usan transacciones MongoDB para consistencia
5. **Sincronización**: Los cambios se sincronizan automáticamente a la colección global

## 🔮 Próximos Pasos

- [ ] Métricas de movimientos warehouse↔office
- [ ] Dashboard para visualizar flujos de productos
- [ ] Notificaciones Slack para movimientos entre ubicaciones
- [ ] Reportes de eficiencia de warehouse vs office

---

**Implementado por:** Augment Agent  
**Fecha:** 2025-10-23  
**Versión:** 1.0.0
