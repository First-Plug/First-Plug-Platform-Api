# Fix tenantId Types - Conversión de String a ObjectId

## 📋 Problema

Algunos productos en la colección `global_products` tienen el campo `tenantId` como **String** en lugar de **ObjectId**.

### ¿Por qué pasó esto?

1. **Schema anterior:** El schema de `GlobalProduct` tenía `tenantId` definido como `string`
2. **Conversión automática:** Mongoose convertía automáticamente ObjectId → String según el schema
3. **Operaciones posteriores:** Cada vez que se actualizaba un producto, Mongoose guardaba el `tenantId` como String

### ¿Por qué es un problema?

- **Duplicados:** Cuando el código busca productos con `tenantId` como ObjectId, no encuentra los que tienen String, creando duplicados
- **Queries ineficientes:** Las búsquedas por `tenantId` no funcionan correctamente si hay mezcla de tipos
- **Inconsistencia:** Algunos productos tienen ObjectId, otros String

---

## ✅ Solución Aplicada

### 1. Schema Corregido

**Archivo:** `src/products/schemas/global-product.schema.ts`

```typescript
// ANTES (incorrecto)
@Prop({ required: true, index: true })
tenantId: string;

// DESPUÉS (correcto)
@Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
tenantId: MongooseSchema.Types.ObjectId;
```

### 2. Script de Conversión

**Archivo:** `scripts/fix-tenantid-types.ts`

Este script:
1. Busca todos los productos con `tenantId` como String
2. Agrupa por `tenantName`
3. Busca el ObjectId del tenant en la colección `tenants`
4. Actualiza todos los productos con el ObjectId correcto

---

## 🚀 Cómo Usar

### Paso 1: Verificar el Problema

Primero, verifica cuántos productos tienen el problema:

```bash
# Conectarse a MongoDB
mongosh "mongodb://localhost:27017/firstPlug"

# Contar productos con tenantId como String
db.global_products.countDocuments({ tenantId: { $type: "string" } })

# Ver ejemplos
db.global_products.find({ tenantId: { $type: "string" } }).limit(5)
```

### Paso 2: Ejecutar el Script

```bash
npm run fix:tenantid-types
```

### Paso 3: Verificar el Resultado

El script mostrará:
- Total de productos procesados
- Productos actualizados por tenant
- Verificación final

Ejemplo de salida:
```
🔧 Iniciando conversión de tenantId de String a ObjectId...

✅ Conectado a MongoDB

📊 Total productos en global_products: 150

🔍 Productos con tenantId como String: 45

📋 Tenants afectados: 2
   - mechi_test: 40 productos
   - otro_tenant: 5 productos

🔄 Iniciando conversión...

📦 Procesando tenant: mechi_test
   ✅ Tenant encontrado: 67e6cb38b4c6d3af1edd99ef
   📦 Productos a actualizar: 40
   ✅ Actualizados: 40 productos

📦 Procesando tenant: otro_tenant
   ✅ Tenant encontrado: 67e6cb38b4c6d3af1edd99f0
   📦 Productos a actualizar: 5
   ✅ Actualizados: 5 productos

📊 RESUMEN FINAL:
   - Total productos procesados: 45
   - Productos actualizados: 45
   - Errores: 0

🔍 Verificación final:
   - Productos con tenantId como String: 0

🎉 ¡ÉXITO! Todos los productos tienen tenantId como ObjectId
```

### Paso 4: Verificar Manualmente

```bash
# Verificar que no queden productos con String
db.global_products.countDocuments({ tenantId: { $type: "string" } })
# Debe retornar: 0

# Verificar que todos tienen ObjectId
db.global_products.countDocuments({ tenantId: { $type: "objectId" } })
# Debe retornar: total de productos
```

---

## 🔍 Verificación de Tipos en MongoDB

### Comandos Útiles

```javascript
// Ver tipos de tenantId en la colección
db.global_products.aggregate([
  {
    $group: {
      _id: { $type: "$tenantId" },
      count: { $sum: 1 }
    }
  }
])

// Resultado esperado:
// { "_id": "objectId", "count": 150 }

// Ver productos con tenantId como String (no debería haber ninguno)
db.global_products.find({ tenantId: { $type: "string" } }).count()

// Ver productos con tenantId como ObjectId (todos)
db.global_products.find({ tenantId: { $type: "objectId" } }).count()
```

---

## 🛡️ Prevención Futura

### 1. Schema Correcto

El schema ya está corregido en `src/products/schemas/global-product.schema.ts`:

```typescript
@Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
tenantId: MongooseSchema.Types.ObjectId;
```

### 2. Conversión Automática en Sync

El código de sincronización (`GlobalProductSyncService`) ya convierte automáticamente `tenantName` (string) a `tenantId` (ObjectId):

```typescript
// Si tenantId viene como string (tenantName), convertir a ObjectId
if (typeof params.tenantId === 'string') {
  const tenant = await tenantsCollection.findOne({
    tenantName: params.tenantId,
  });
  if (tenant) {
    resolvedTenantId = tenant._id; // ObjectId
  }
}
```

### 3. Validación en Tests

Agregar tests que verifiquen el tipo:

```typescript
// En tests de sincronización
expect(typeof savedProduct.tenantId).toBe('object');
expect(savedProduct.tenantId.constructor.name).toBe('ObjectId');
```

---

## 📊 Monitoreo

### Métricas a Monitorear

1. **Productos con tenantId como String:** Debe ser 0
2. **Productos con tenantId como ObjectId:** Debe ser 100%
3. **Duplicados:** Debe ser 0

### Query de Monitoreo

```javascript
// Ejecutar periódicamente
db.global_products.aggregate([
  {
    $facet: {
      "byType": [
        {
          $group: {
            _id: { $type: "$tenantId" },
            count: { $sum: 1 }
          }
        }
      ],
      "duplicates": [
        {
          $group: {
            _id: {
              tenantId: "$tenantId",
              originalProductId: "$originalProductId"
            },
            count: { $sum: 1 }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]
    }
  }
])
```

---

## 🚨 Troubleshooting

### Problema: Script no encuentra el tenant

**Error:**
```
❌ No se encontró tenant con nombre: mechi_test
```

**Solución:**
1. Verificar que el tenant existe en la colección `tenants`:
   ```javascript
   db.tenants.findOne({ tenantName: "mechi_test" })
   ```
2. Si no existe, crear el tenant primero

### Problema: Todavía quedan productos con String

**Error:**
```
⚠️ Advertencia: Todavía hay 5 productos con tenantId como String
```

**Solución:**
1. Ejecutar el script de nuevo
2. Verificar manualmente los productos que quedaron:
   ```javascript
   db.global_products.find({ tenantId: { $type: "string" } })
   ```
3. Actualizar manualmente si es necesario

### Problema: Duplicados después de la conversión

**Solución:**
```bash
npm run cleanup:global-products
```

---

## 📚 Referencias

- [Global Product Sync Documentation](./GLOBAL-PRODUCT-SYNC.md)
- [Changelog](./CHANGELOG-GLOBAL-SYNC.md)
- [MongoDB Type Operators](https://www.mongodb.com/docs/manual/reference/operator/query/type/)

