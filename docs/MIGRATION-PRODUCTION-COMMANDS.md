# 📋 COMANDOS PARA MIGRACIÓN EN PRODUCCIÓN

## 🎯 OBJETIVO

Migrar productos de tenants a `global_products` con métricas en tiempo real.

---

## ⚠️ IMPORTANTE

- **NO** se generan métricas pre-calculadas
- Las métricas se calculan en tiempo real desde `global_products`
- Solo necesitas crear los índices una vez

---

## 📦 PASOS PARA CADA TENANT

### **1. Preparar Warehouses (Solo una vez)**

```bash
# Crear warehouses para todos los países
npm run migrate:prepare-warehouses
```

**Qué hace:**

- Crea colección `warehouses` en `firstPlug`
- Crea un warehouse default por cada país
- Solo se ejecuta una vez para toda la base de datos

---

### **2. Migrar Members a Global**

```bash
npm run migrate:members-to-global -- --tenant=NOMBRE_TENANT
```

**Qué hace:**

- Migra productos de `members` a `global_products`
- Preserva información del member en `memberData`

---

### **3. Migrar Products a Global**

```bash
npm run migrate:products-to-global -- --tenant=NOMBRE_TENANT
```

**Qué hace:**

- Migra productos de `products` a `global_products`
- Preserva información del warehouse en `fpWarehouse`
- **Corrige automáticamente warehouse IDs inválidos** usando warehouse default del país
- **NO genera métricas** (se calculan en tiempo real)

---

### **4. Crear Índices (Solo una vez)**

```bash
# Crear índices para agregaciones rápidas
npm run create:warehouse-indexes
```

**Qué hace:**

- Crea `warehouse_metrics_aggregation_idx` en `global_products`
- Crea `warehouse_country_idx` en `global_products`
- Solo se ejecuta una vez para toda la base de datos

---

## 🔄 ORDEN COMPLETO PARA MÚLTIPLES TENANTS

```bash
# ==================== SETUP INICIAL (UNA VEZ) ====================
# 1. Preparar warehouses
npm run migrate:prepare-warehouses

# 2. Crear índices
npm run create:warehouse-indexes

# ==================== POR CADA TENANT ====================
# 3. Migrar members
npm run migrate:members-to-global -- --tenant=tenant1

# 4. Migrar products (corrige warehouse IDs automáticamente)
npm run migrate:products-to-global -- --tenant=tenant1

# Repetir pasos 3-4 para cada tenant
npm run migrate:members-to-global -- --tenant=tenant2
npm run migrate:products-to-global -- --tenant=tenant2

# ... etc
```

---

## 🧪 VERIFICACIÓN

### **Verificar migración de un tenant:**

```javascript
// En MongoDB Compass o mongo shell
use firstPlug

// Contar productos del tenant en global
db.global_products.countDocuments({
  tenantName: "NOMBRE_TENANT",
  isDeleted: {$ne: true}
})

// Verificar productos en FP warehouse
db.global_products.countDocuments({
  tenantName: "NOMBRE_TENANT",
  inFpWarehouse: true,
  isDeleted: {$ne: true}
})
```

### **Verificar métricas en tiempo real:**

```bash
# Ver métricas de todos los warehouses
GET http://localhost:3001/api/superadmin/metrics/warehouses

# Ver métricas por país
GET http://localhost:3001/api/superadmin/metrics/countries/AR
```

---

## 📊 ÍNDICES CREADOS

### **warehouse_metrics_aggregation_idx**

```javascript
{
  "fpWarehouse.warehouseId": 1,
  "inFpWarehouse": 1,
  "isDeleted": 1,
  "isComputer": 1,
  "tenantId": 1
}
```

**Uso:** Agregaciones de métricas por warehouse

### **warehouse_country_idx**

```javascript
{
  "fpWarehouse.warehouseCountryCode": 1,
  "inFpWarehouse": 1,
  "isDeleted": 1
}
```

**Uso:** Queries de métricas por país

---

## ⚠️ TROUBLESHOOTING

### **Problema: Productos sin fpWarehouse**

```bash
# Ejecutar script de corrección
npm run fix:missing-fpwarehouse
```

### **Problema: Warehouse IDs incorrectos**

```bash
# Ejecutar antes de migrar
npm run fix:tenant-warehouse-ids -- --tenant=NOMBRE_TENANT
```

### **Problema: Métricas no coinciden**

Las métricas se calculan en tiempo real, siempre son correctas.
Si hay discrepancia, verificar:

1. Productos con `isDeleted: true` (no se cuentan)
2. Productos con `inFpWarehouse: false` (no se cuentan)

---

## 🗑️ LIMPIEZA POST-MIGRACIÓN

### **Eliminar colección obsoleta:**

```bash
npm run cleanup:old-metrics
```

**Qué hace:**

- Elimina colección `warehouse_metrics` (obsoleta)
- Elimina colección `warehousemetrics` (si existe)

---

## 📝 NOTAS

- **Performance:** Métricas se calculan en <1s
- **Consistencia:** Siempre correctas, calculadas desde source of truth
- **Mantenimiento:** No requiere scripts de corrección
- **Escalabilidad:** Solo calcula métricas para warehouses con productos

---

## 🔗 ENDPOINTS DE MÉTRICAS

```bash
# Overview general
GET /api/superadmin/metrics/overview

# Todos los warehouses con productos
GET /api/superadmin/metrics/warehouses

# Warehouse específico
GET /api/superadmin/metrics/warehouses/:countryCode/:warehouseId

# Tenants en un warehouse
GET /api/superadmin/metrics/warehouses/:countryCode/:warehouseId/tenants

# Métricas por país
GET /api/superadmin/metrics/countries/:countryCode

# Métricas por categoría
GET /api/superadmin/metrics/categories
```
