# Fix Product Condition Migration Guide

## Descripción

Este script repara productos que no tienen la key `productCondition` agregando el valor default `'Optimal'`. 

El campo `productCondition` fue agregado posteriormente al desarrollo inicial, por lo que algunos productos creados antes de esta implementación no tienen este campo. Esto causa errores en varias partes de la aplicación que esperan que este campo siempre esté presente.

## Problema

- **Valores válidos**: `'Optimal'`, `'Defective'`, `'Unusable'`
- **Comportamiento esperado**: Cuando se crea un producto sin especificar `productCondition`, se asigna `'Optimal'` por defecto
- **Problema**: Productos antiguos no tienen esta key, causando errores en validaciones y lógica de negocio

## Solución

El script recorre tres ubicaciones y agrega `productCondition: 'Optimal'` a productos que no tengan esta key:

1. **Colección `products`** del tenant
2. **Colección `members`** del tenant (dentro del array `products` embebido)
3. **Colección `global_products`** (sincroniza cambios desde las dos anteriores)

## Uso

### Comando

```bash
npm run migrate:fix-product-condition -- --tenant=NOMBRE_TENANT
```

### Ejemplo

```bash
npm run migrate:fix-product-condition -- --tenant=mechi_test
```

## Proceso de Migración

### 1. Validación Inicial
- Verifica que se especifique el nombre del tenant
- Busca el tenant en la BD global
- Valida que exista la BD del tenant

### 2. Reparación en Colección `products`
- Busca productos sin `productCondition`
- Agrega `productCondition: 'Optimal'` a todos
- Actualiza `updatedAt` timestamp
- Registra IDs de productos actualizados

### 3. Reparación en Colección `members`
- Busca members con productos sin `productCondition`
- Usa `arrayFilters` para actualizar solo los productos sin la key
- Agrega `productCondition: 'Optimal'` a cada producto
- Registra IDs de productos actualizados

### 4. Sincronización en `global_products`
- Para cada producto actualizado, busca su referencia en `global_products`
- Agrega `productCondition: 'Optimal'` si no existe
- Mantiene consistencia entre colecciones

## Características de Seguridad

### ✅ No Sobrescribe Datos Existentes
- Si un producto ya tiene `productCondition`, **no se modifica**
- Solo agrega la key si está ausente (`$exists: false`)

### ✅ Migración por Tenant
- Se ejecuta un tenant a la vez
- Permite verificar resultados antes de continuar con otros tenants
- Facilita rollback si es necesario

### ✅ Soft Delete Respetado
- Solo procesa productos no eliminados (`isDeleted: { $ne: true }`)
- Productos eliminados no se modifican

### ✅ Sincronización Global
- Actualiza automáticamente `global_products`
- Mantiene consistencia entre BD del tenant y BD global

## Validaciones Zod

El campo `productCondition` está validado en:

### Product Schema (Mongoose)
```typescript
@Prop({
  enum: CONDITION,  // ['Optimal', 'Defective', 'Unusable']
  required: false,
})
productCondition: Condition;
```

### Zod Validations
- **Create Product**: `z.enum(CONDITION)` - requerido
- **CSV Import**: `z.enum(CONDITION).optional()` - opcional, default 'Optimal'
- **Update Product**: `z.enum(CONDITION).optional()` - opcional

### Reglas de Negocio
- Si `productCondition === 'Unusable'`, entonces `status` debe ser `'Unavailable'`

## Salida del Script

El script muestra:

```
🚀 FIX PRODUCT CONDITION: Reparando productos para tenant mechi_test
🔗 Conectando a: mongodb://***:***@...
✅ Conectado a MongoDB
📂 Base de datos global: firstPlug
🔍 Buscando tenant: mechi_test
✅ Tenant encontrado: mechi_test (ID: 507f1f77bcf86cd799439011)

📦 Procesando colección "products"...
🔧 Productos sin productCondition: 5
✅ Productos actualizados: 5

👥 Procesando colección "members"...
👤 Members con productos sin productCondition: 3
✅ Productos en members actualizados: 8

🌍 Sincronizando con global_products...
✅ Productos en global_products actualizados: 13

🎉 MIGRACIÓN COMPLETADA:
   - Total productos reparados: 13
   - Productos en global_products sincronizados: 13
🔌 Conexión cerrada
```

## Ejecución Paso a Paso

### 1. Preparación
```bash
# Asegurar que las variables de entorno están configuradas
# DB_CONNECTION_STRING o MONGO_URI debe apuntar a MongoDB
```

### 2. Ejecución
```bash
npm run migrate:fix-product-condition -- --tenant=nombre_tenant
```

### 3. Verificación
- Revisar el output del script
- Confirmar que el número de productos reparados es correcto
- Verificar que no hay errores

### 4. Validación Manual (Opcional)
```javascript
// En MongoDB, verificar que los productos tienen productCondition
db.tenant_nombre_tenant.products.find({ productCondition: { $exists: false } }).count()
// Debe retornar 0

db.tenant_nombre_tenant.members.find({ 'products.productCondition': { $exists: false } }).count()
// Debe retornar 0
```

## Rollback

Si es necesario revertir los cambios:

```javascript
// Eliminar productCondition agregado (solo si fue agregado por este script)
db.tenant_nombre_tenant.products.updateMany(
  { productCondition: 'Optimal' },
  { $unset: { productCondition: '' } }
)

db.tenant_nombre_tenant.members.updateMany(
  { 'products.productCondition': 'Optimal' },
  { $unset: { 'products.$[].productCondition': '' } }
)
```

## Notas Importantes

- ⚠️ El script **no modifica** productos que ya tienen `productCondition`
- ⚠️ Solo agrega la key con valor `'Optimal'` si está ausente
- ⚠️ Respeta soft deletes (no toca productos eliminados)
- ⚠️ Sincroniza automáticamente con `global_products`
- ⚠️ Ejecutar un tenant a la vez para mejor control

## Troubleshooting

### Error: "No se encontró tenant"
- Verificar que el nombre del tenant es correcto
- Verificar que el tenant existe en la BD global

### Error: "Conectando a MongoDB"
- Verificar que `DB_CONNECTION_STRING` o `MONGO_URI` está configurado
- Verificar que MongoDB está corriendo
- Verificar credenciales de conexión

### Pocos productos actualizados
- Verificar que los productos realmente no tienen `productCondition`
- Revisar logs del script para detalles
- Ejecutar validación manual en MongoDB

