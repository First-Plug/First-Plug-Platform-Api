# 🏗️ Arquitectura de Servicios - Warehouse Management

## 📋 Principios de Arquitectura

### Regla de Oro: Servicios Desacoplados

Los servicios de raíz **NO** deben conocer ni interactuar directamente con otros servicios de raíz. Solo deben conocer su propia colección y lógica de negocio.

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVICIOS DE RAÍZ                        │
│  (Solo conocen su propia colección)                         │
├─────────────────────────────────────────────────────────────┤
│  • WarehousesService  → warehouses collection (firstPlug)   │
│  • ProductsService    → products collection (por tenant)    │
│  • MembersService     → members collection (por tenant)     │
│  • ShipmentsService   → shipments collection (por tenant)   │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │
                            │ Usan
                            │
┌─────────────────────────────────────────────────────────────┐
│                 SERVICIOS TRANSVERSALES                      │
│  (Coordinan entre servicios de raíz)                        │
├─────────────────────────────────────────────────────────────┤
│  • WarehouseAssignmentService                               │
│  • ProductWarehouseMigrationService (A IMPLEMENTAR)         │
│  • LogisticsService                                         │
│  • GlobalProductSyncService                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementación Actual (Correcta)

### WarehousesService

**Responsabilidades:**
- ✅ CRUD de warehouses en la colección `firstPlug.warehouses`
- ✅ Validar completitud de warehouses
- ✅ Activar/desactivar warehouses
- ✅ Gestionar regla de "1 activo por país"
- ✅ Retornar información necesaria para otros servicios

**NO hace:**
- ❌ NO accede a la colección de productos
- ❌ NO migra productos
- ❌ NO conoce la estructura de productos
- ❌ NO accede a bases de datos de tenants

**Ejemplo de método correcto:**

```typescript
async toggleWarehouseActive(
  country: string,
  warehouseId: string,
  isActive: boolean,
): Promise<{
  success: boolean;
  message: string;
  warehouse: WarehouseItem;
  deactivatedWarehouses?: string[];
  countryCode?: string;        // ← Retorna info para otros servicios
  warehouseId?: string;         // ← Retorna info para otros servicios
  warehouseName?: string;       // ← Retorna info para otros servicios
  warning?: string;
}> {
  // 1. Validar y actualizar warehouse
  // 2. Desactivar otros warehouses del país
  // 3. Guardar cambios
  // 4. Retornar información
  
  // ✅ NO migra productos aquí
  // ✅ Retorna información para que otro servicio lo haga
}
```

---

## 🔄 Migración de Productos (A Implementar)

### Servicio Transversal: ProductWarehouseMigrationService

Este servicio debe ser creado para manejar la migración de productos cuando cambia el warehouse activo.

**Ubicación sugerida:**
```
src/
  warehouses/
    services/
      product-warehouse-migration.service.ts  ← NUEVO
```

**Responsabilidades:**
- Escuchar eventos de cambio de warehouse activo
- Migrar productos de todos los tenants
- Actualizar colección global de productos
- Manejar errores y reintentos

**Dependencias:**
```typescript
@Injectable()
export class ProductWarehouseMigrationService {
  constructor(
    @InjectConnection('firstPlug') 
    private firstPlugConnection: Connection,
    
    // Opcional: inyectar servicios si es necesario
    private readonly warehousesService: WarehousesService,
    private readonly globalProductSyncService: GlobalProductSyncService,
  ) {}
}
```

**Métodos principales:**

```typescript
/**
 * Migrar productos cuando cambia el warehouse activo
 */
async migrateProductsToNewWarehouse(
  countryCode: string,
  newWarehouseId: string,
  newWarehouseName: string,
): Promise<{
  migratedProducts: number;
  affectedTenants: number;
  errors?: string[];
}> {
  // 1. Obtener lista de tenants
  const tenants = await this.getAllTenants();
  
  // 2. Migrar productos en cada tenant
  for (const tenant of tenants) {
    await this.migrateProductsInTenant(
      tenant,
      countryCode,
      newWarehouseId,
      newWarehouseName,
    );
  }
  
  // 3. Actualizar colección global
  await this.globalProductSyncService.syncWarehouseChange(
    countryCode,
    newWarehouseId,
  );
  
  return result;
}

/**
 * Migrar productos en un tenant específico
 */
private async migrateProductsInTenant(
  tenantName: string,
  countryCode: string,
  newWarehouseId: string,
  newWarehouseName: string,
): Promise<number> {
  const tenantConnection = this.firstPlugConnection.useDb(tenantName);
  const ProductModel = tenantConnection.model('Product');
  
  const result = await ProductModel.updateMany(
    {
      location: 'FP warehouse',
      'fpWarehouse.warehouseCountryCode': countryCode,
    },
    {
      $set: {
        'fpWarehouse.warehouseId': new Types.ObjectId(newWarehouseId),
        'fpWarehouse.warehouseName': newWarehouseName,
        'fpWarehouse.assignedAt': new Date(),
      },
    },
  );
  
  return result.modifiedCount;
}
```

---

## 🔌 Integración con SuperAdmin Controller

### Opción 1: Migración Automática (Recomendada)

El controller llama al servicio transversal después de activar el warehouse:

```typescript
@Patch('warehouses/:country/:warehouseId/toggle-active')
async toggleWarehouseActive(
  @Param('country') country: string,
  @Param('warehouseId') warehouseId: string,
  @Body() toggleDto: ToggleWarehouseActiveDto,
) {
  // 1. Activar warehouse (servicio de raíz)
  const result = await this.warehousesService.toggleWarehouseActive(
    country,
    warehouseId,
    toggleDto.isActive,
  );
  
  // 2. Si se activó y había otros activos, migrar productos (servicio transversal)
  if (
    result.success && 
    toggleDto.isActive && 
    result.deactivatedWarehouses?.length > 0
  ) {
    try {
      const migrationResult = await this.productWarehouseMigrationService
        .migrateProductsToNewWarehouse(
          result.countryCode,
          result.warehouseId,
          result.warehouseName,
        );
      
      // Agregar info de migración al resultado
      return {
        ...result,
        migratedProducts: migrationResult.migratedProducts,
        affectedTenants: migrationResult.affectedTenants,
      };
    } catch (error) {
      this.logger.error('Error migrating products:', error);
      // No fallar la activación si falla la migración
      return {
        ...result,
        migrationWarning: 'Warehouse activated but product migration failed',
      };
    }
  }
  
  return result;
}
```

### Opción 2: Migración Asíncrona con Eventos

Usar un sistema de eventos para desacoplar completamente:

```typescript
// En WarehousesService
async toggleWarehouseActive(...) {
  // ... activar warehouse ...
  
  // Emitir evento
  this.eventEmitter.emit('warehouse.activated', {
    countryCode,
    warehouseId,
    warehouseName,
    deactivatedWarehouses,
  });
  
  return result;
}

// En ProductWarehouseMigrationService
@OnEvent('warehouse.activated')
async handleWarehouseActivated(payload: WarehouseActivatedEvent) {
  if (payload.deactivatedWarehouses?.length > 0) {
    await this.migrateProductsToNewWarehouse(
      payload.countryCode,
      payload.warehouseId,
      payload.warehouseName,
    );
  }
}
```

---

## 📊 Comparación de Enfoques

| Aspecto | Migración en Controller | Migración con Eventos |
|---------|------------------------|----------------------|
| **Acoplamiento** | Medio | Bajo |
| **Complejidad** | Baja | Media |
| **Testabilidad** | Alta | Alta |
| **Respuesta al usuario** | Síncrona (espera migración) | Asíncrona (responde inmediatamente) |
| **Manejo de errores** | Directo | Requiere logging/monitoring |
| **Recomendado para** | Pocos productos | Muchos productos |

---

## 🎯 Recomendación Final

### Para Implementación Inmediata:

**Opción 1: Migración en Controller** (más simple)

1. Crear `ProductWarehouseMigrationService`
2. Inyectarlo en `SuperAdminController`
3. Llamarlo después de activar warehouse
4. Retornar resultado combinado

### Para Implementación Futura:

**Opción 2: Sistema de Eventos** (más escalable)

1. Implementar `@nestjs/event-emitter`
2. Emitir eventos desde `WarehousesService`
3. Escuchar eventos en `ProductWarehouseMigrationService`
4. Procesar migraciones de forma asíncrona

---

## 📝 Checklist de Implementación

### Fase 1: Crear Servicio Transversal
- [ ] Crear `ProductWarehouseMigrationService`
- [ ] Implementar método `migrateProductsToNewWarehouse()`
- [ ] Implementar método `migrateProductsInTenant()`
- [ ] Agregar manejo de errores y logging
- [ ] Escribir tests unitarios

### Fase 2: Integrar con Controller
- [ ] Inyectar servicio en `SuperAdminController`
- [ ] Llamar servicio después de activar warehouse
- [ ] Manejar errores de migración
- [ ] Actualizar respuesta del endpoint
- [ ] Actualizar documentación

### Fase 3: Testing
- [ ] Test de migración exitosa
- [ ] Test de migración con errores
- [ ] Test de múltiples tenants
- [ ] Test de productos sin fpWarehouse
- [ ] Test end-to-end

### Fase 4: Documentación
- [ ] Actualizar `SUPERADMIN-WAREHOUSE-ENDPOINTS.md`
- [ ] Actualizar `SUPERADMIN-WAREHOUSE-EXAMPLES.md`
- [ ] Documentar arquitectura de servicios
- [ ] Crear diagrama de flujo

---

## 🚀 Beneficios de Esta Arquitectura

### ✅ Ventajas

1. **Desacoplamiento**: Cada servicio tiene una responsabilidad clara
2. **Testabilidad**: Fácil de testear cada servicio por separado
3. **Mantenibilidad**: Cambios en un servicio no afectan a otros
4. **Escalabilidad**: Fácil agregar nuevas funcionalidades
5. **Reutilización**: Servicios transversales pueden usarse en múltiples contextos

### 🎯 Casos de Uso

- **WarehousesService**: Solo gestiona warehouses
- **ProductWarehouseMigrationService**: Coordina migración de productos
- **GlobalProductSyncService**: Sincroniza colección global
- **WarehouseAssignmentService**: Asigna productos a warehouses

---

## 📚 Referencias

- Principio de Responsabilidad Única (SRP)
- Inversión de Dependencias (DIP)
- Patrón de Servicios Transversales
- Event-Driven Architecture

---

**Última Actualización:** 2025-01-20
**Versión:** 1.0
**Estado:** ✅ Arquitectura Correcta Implementada

