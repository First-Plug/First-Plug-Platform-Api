# Multi-Office Migration Guide

## Descripción

Esta migración convierte el sistema de una oficina única por tenant a un sistema multi-oficina, donde cada tenant puede tener múltiples oficinas y seleccionar oficinas específicas para operaciones.

## Cambios Principales

### 1. Esquemas Actualizados

- **Products**: Agregado campo `officeId` para identificar oficina específica cuando `location="Our office"`
- **Shipments**: Agregados campos `originOfficeId` y `destinationOfficeId` para identificar oficinas específicas
- **Offices**: Nuevos endpoints CRUD completos con validaciones Zod

### 2. Lógica de Negocio

- **LogisticsService**: Métodos actualizados para manejar oficinas específicas por ID
- **ShipmentsService**: `getLocationInfo` acepta `officeId` opcional
- **AssignmentsService**: Operaciones assign/return/relocate manejan `officeId`
- **OfficesService**: CRUD completo con toggle de oficina default

### 3. Eventos

- **OfficeAddressUpdatedEvent**: Incluye `officeId`, `officeName`, `isDefault` para identificar oficina específica
- **Listeners**: Actualizados para manejar cambios en oficinas específicas

## Scripts de Migración

### Comandos Disponibles

```bash
# Migración completa (recomendado)
npm run migrate:multi-office:complete

# Solo migración de datos
npm run migrate:multi-office

# Solo validación
npm run validate:multi-office
```

### 1. Migración de Datos (`multi-office-migration.ts`)

**Qué hace:**
- Asigna `officeId` de la oficina default a productos con `location="Our office"`
- Asigna `originOfficeId`/`destinationOfficeId` a shipments con origin/destination="Our office"
- Maneja productos tanto en colección `products` como embebidos en `members`

**Proceso:**
1. Obtiene oficina default de cada tenant
2. Actualiza productos en colección `products`
3. Actualiza productos embebidos en colección `members`
4. Actualiza shipments con origin="Our office"
5. Actualiza shipments con destination="Our office"

### 2. Validación (`multi-office-validation.ts`)

**Qué valida:**
- Productos con `location="Our office"` tienen `officeId` válido
- Shipments con origin/destination="Our office" tienen officeIds válidos
- Todos los officeIds referencian oficinas existentes
- Reporta inconsistencias detalladas

### 3. Script Completo (`run-multi-office-migration.ts`)

Ejecuta migración + validación + reporte final.

## Compatibilidad con Datos Existentes

### Productos
- ✅ Productos existentes con `location="Our office"` → asignados a oficina default
- ✅ Productos con otras locations → sin cambios
- ✅ Productos embebidos en members → migrados correctamente

### Shipments
- ✅ Shipments con origin="Our office" → `originOfficeId` asignado
- ✅ Shipments con destination="Our office" → `destinationOfficeId` asignado
- ✅ Shipments con otras locations → sin cambios

### Oficinas
- ✅ Oficina default existente → marcada como `isDefault: true`
- ✅ Nuevas oficinas → pueden crearse con `isDefault: false`
- ✅ Toggle default → solo una oficina puede ser default por tenant

## Validaciones Implementadas

### Zod Schemas
- **CreateOfficeSchemaZod**: Validación completa para crear oficinas
- **UpdateOfficeSchemaZod**: Validación parcial para actualizar
- **ToggleDefaultOfficeSchemaZod**: Validación para toggle default

### Reglas de Negocio
- Solo una oficina puede ser default por tenant
- Oficina default no puede ser eliminada (soft delete)
- OfficeId es requerido cuando location="Our office" en nuevos productos/shipments

## Endpoints Nuevos

### Offices CRUD
```
GET    /offices           # Listar todas las oficinas del tenant
POST   /offices           # Crear nueva oficina
PATCH  /offices/:id       # Actualizar oficina
DELETE /offices/:id       # Soft delete oficina
PATCH  /offices/:id/toggle-default  # Toggle oficina default
```

### Autenticación
Todos los endpoints requieren `JwtGuard` y extraen `tenantName` del usuario autenticado.

## Consideraciones de Rendimiento

### Índices Recomendados
```javascript
// Productos
db.products.createIndex({ "location": 1, "officeId": 1 })

// Shipments  
db.shipments.createIndex({ "origin": 1, "originOfficeId": 1 })
db.shipments.createIndex({ "destination": 1, "destinationOfficeId": 1 })

// Oficinas
db.offices.createIndex({ "tenantName": 1, "isDefault": 1 })
db.offices.createIndex({ "tenantName": 1, "isDeleted": 1 })
```

### Transacciones
- Migración usa transacciones MongoDB para consistencia
- Operaciones CRUD de oficinas usan transacciones cuando es necesario

## Testing

### Tests Unitarios
- [ ] OfficesService CRUD operations
- [ ] LogisticsService con officeId
- [ ] ShipmentsService getLocationInfo con officeId
- [ ] AssignmentsService con officeId

### Tests de Integración
- [ ] Crear producto con officeId específico
- [ ] Crear shipment con oficinas específicas
- [ ] Toggle oficina default
- [ ] Validación de datos completos con oficina específica

### Tests de Migración
- [ ] Migración de productos existentes
- [ ] Migración de shipments existentes
- [ ] Validación post-migración

## Rollback Plan

En caso de necesitar rollback:

1. **Backup**: Asegurar backup completo antes de migración
2. **Campos opcionales**: Los campos `officeId` son opcionales, sistema funciona sin ellos
3. **Fallback**: Lógica incluye fallback a oficina default cuando no hay officeId
4. **Reversión**: Eliminar campos agregados si es necesario

## Monitoreo Post-Migración

### Métricas a Monitorear
- Productos sin officeId cuando location="Our office"
- Shipments sin officeIds cuando origin/destination="Our office"
- Errores en validación de oficinas
- Performance de queries con officeId

### Logs Importantes
- `🔍 Buscando shipments para actualizar oficina` - Eventos de oficina
- `❌ Oficina no encontrada` - Errores de validación
- `📍 Dirección de oficina actualizada` - Cambios de dirección

## Próximos Pasos

1. ✅ Ejecutar migración en desarrollo
2. ✅ Validar integridad de datos
3. ⏳ Ejecutar tests unitarios e integración
4. ⏳ Probar funcionalidad en staging
5. ⏳ Desplegar en producción
6. ⏳ Monitorear métricas post-despliegue
