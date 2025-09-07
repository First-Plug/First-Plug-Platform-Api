# SuperAdmin Platform

## Descripción

El sistema SuperAdmin permite a usuarios con rol `superadmin` acceder y gestionar datos de todos los tenants desde un nivel superior, sin las restricciones del middleware de tenants.

## Características Implementadas

### 1. **Cross-Tenant Data Access**
- Acceso a datos de múltiples tenants sin restricciones de middleware
- Iteración automática sobre todas las bases de datos de tenants activos
- Agregación de datos con metadata del tenant de origen

### 2. **Gestión de Usuarios**
- Listar todos los usuarios del sistema
- Identificar usuarios sin tenant asignado
- Asignar tenants a usuarios específicos
- Activación automática de usuarios al asignar tenant

### 3. **Gestión de Tenants**
- Listar todos los tenants activos
- Editar información de tenants (nombre, configuración, etc.)
- Ver y editar datos de oficinas de cualquier tenant

### 4. **Gestión de Shipments Cross-Tenant**
- Obtener shipments de todos los tenants con paginación
- Actualizar shipments de cualquier tenant
- Reemplaza la funcionalidad de Retool con validaciones apropiadas

### 5. **Auditoría y Logging**
- Logging detallado de todas las operaciones
- Interceptor de auditoría para tracking de acciones
- Manejo robusto de errores con logging específico

## Endpoints Disponibles

### Estadísticas
```
GET /super-admin/stats
```
Obtiene estadísticas generales del sistema (usuarios, tenants, shipments).

### Gestión de Usuarios
```
GET /super-admin/users
GET /super-admin/users/without-tenant
POST /super-admin/users/:userId/assign-tenant
```

### Gestión de Tenants
```
GET /super-admin/tenants
PATCH /super-admin/tenants/:tenantId
GET /super-admin/tenants/:tenantName/office
PATCH /super-admin/tenants/:tenantName/office/:officeId
```

### Gestión de Shipments
```
GET /super-admin/shipments?page=1&size=10
PATCH /super-admin/shipments/:tenantName/:shipmentId
```

## Seguridad

- Todos los endpoints están protegidos por `JwtGuard` y `SuperAdminGuard`
- Solo usuarios con `role: 'superadmin'` pueden acceder
- Validaciones exhaustivas de parámetros y existencia de recursos
- Logging de auditoría para todas las operaciones

## Estructura de Archivos

```
src/auth/super-admin/
├── super-admin.controller.ts      # Controlador con endpoints
├── super-admin.service.ts         # Lógica de negocio cross-tenant
├── super-admin.module.ts          # Módulo NestJS
├── dto/                           # DTOs para validación
│   ├── assign-tenant.dto.ts
│   ├── update-tenant.dto.ts
│   ├── update-office.dto.ts
│   └── update-shipment.dto.ts
├── interceptors/                  # Interceptores
│   └── super-admin-audit.interceptor.ts
└── README.md                      # Esta documentación
```

## Ejemplo de Uso

### 1. Obtener usuarios sin tenant
```bash
curl -X GET "http://localhost:3000/super-admin/users/without-tenant" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN"
```

### 2. Asignar tenant a usuario
```bash
curl -X POST "http://localhost:3000/super-admin/users/USER_ID/assign-tenant" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_ID"}'
```

### 3. Obtener shipments de todos los tenants
```bash
curl -X GET "http://localhost:3000/super-admin/shipments?page=1&size=20" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN"
```

### 4. Actualizar shipment
```bash
curl -X PATCH "http://localhost:3000/super-admin/shipments/TENANT_NAME/SHIPMENT_ID" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shipment_status": "Delivered", "trackingURL": "https://tracking.example.com/123"}'
```

## Ventajas sobre Retool

1. **Integración Nativa**: Parte del mismo sistema, no herramienta externa
2. **Validaciones Robustas**: Validaciones de negocio y seguridad integradas
3. **Auditoría Completa**: Logging detallado de todas las operaciones
4. **Tipo Safety**: TypeScript con validaciones en tiempo de compilación
5. **Escalabilidad**: Manejo eficiente de múltiples tenants
6. **Mantenibilidad**: Código versionado junto con el resto del sistema

## Consideraciones de Rendimiento

- Las operaciones cross-tenant pueden ser costosas con muchos tenants
- Se implementa paginación para shipments
- Manejo de errores por tenant individual (continúa si un tenant falla)
- Conexiones de base de datos reutilizadas a través del TenantConnectionService

## Próximos Pasos

1. Implementar filtros avanzados para shipments
2. Agregar endpoints para gestión de productos cross-tenant
3. Implementar cache para operaciones frecuentes
4. Crear dashboard web para SuperAdmin
5. Agregar métricas y monitoreo específico
