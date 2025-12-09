# 🧪 TESTING DESDE RAPIDAPI - Flexibilización de Atributos

## 📋 ENDPOINTS A PROBAR

### 1. POST /products - Crear Producto Individual

**URL**: `http://localhost:3000/products`

**Headers**:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body - Caso 1: Valor Hardcodeado (ANTES) - Asignado a Oficina**:

```json
{
  "category": "Computer",
  "name": "MacBook Pro",
  "attributes": [
    { "key": "brand", "value": "Apple" },
    { "key": "model", "value": "MacBook Pro 16" },
    { "key": "processor", "value": "Intel Core i9" },
    { "key": "ram", "value": "16GB" },
    { "key": "storage", "value": "512GB SSD" },
    { "key": "screen", "value": "16 inch" }
  ],
  "location": "Our office",
  "country": "US",
  "officeName": "Main Office",
  "status": "Available",
  "productCondition": "Optimal"
}
```

**Nota**: Cuando `location` es "Our office", **DEBES enviar**:

- `country`: Código del país (ej: "US", "ES", "MX")
- `officeName`: Nombre de la oficina (ej: "Main Office", "Oficina Central")

**Body - Caso 2: Valor Custom (NUEVO) ✅ - Asignado a Oficina**:

```json
{
  "category": "Computer",
  "name": "Custom Laptop",
  "attributes": [
    { "key": "brand", "value": "Mi Brand Custom" },
    { "key": "model", "value": "Mi Modelo Especial" },
    { "key": "processor", "value": "AMD Ryzen 9 Custom" },
    { "key": "ram", "value": "32GB Custom" },
    { "key": "storage", "value": "1TB Custom SSD" },
    { "key": "screen", "value": "17.5 inch Custom" }
  ],
  "location": "Our office",
  "country": "ES",
  "officeName": "Oficina Madrid",
  "status": "Available",
  "productCondition": "Optimal"
}
```

**Resultado Esperado**: ✅ 201 Created (ambos casos funcionan con custom values)

---

### 2. POST /products/bulkcreate - Crear Múltiples Productos

**URL**: `http://localhost:3000/products/bulkcreate`

**Body - Mix de Hardcodeados y Custom - Asignados a Oficinas**:

```json
[
  {
    "category": "Computer",
    "name": "MacBook",
    "attributes": [
      { "key": "brand", "value": "Apple" },
      { "key": "model", "value": "MacBook Pro 16" },
      { "key": "processor", "value": "Intel Core i9" },
      { "key": "ram", "value": "16GB" },
      { "key": "storage", "value": "512GB SSD" },
      { "key": "screen", "value": "16 inch" }
    ],
    "location": "Our office",
    "country": "US",
    "officeName": "New York Office",
    "status": "Available",
    "productCondition": "Optimal"
  },
  {
    "category": "Computer",
    "name": "Custom PC",
    "attributes": [
      { "key": "brand", "value": "Mi Marca Personalizada" },
      { "key": "model", "value": "Modelo Único" },
      { "key": "processor", "value": "Procesador Especial" },
      { "key": "ram", "value": "64GB" },
      { "key": "storage", "value": "2TB" },
      { "key": "screen", "value": "27 inch" }
    ],
    "location": "Our office",
    "country": "MX",
    "officeName": "Oficina México",
    "status": "Available",
    "productCondition": "Optimal"
  }
]
```

**Nota**: Cada producto en el array debe incluir `country` y `officeName` cuando `location` es "Our office"

---

### 3. GET /products/table - Ver Agrupamiento Normalizado

**URL**: `http://localhost:3000/products/table`

**Resultado Esperado**:

- Productos con "Apple", "APPLE", " apple " se agrupan juntos
- Productos con "Mi Brand", "mi brand", " MI BRAND " se agrupan juntos
- Normalización funciona correctamente

---

### 4. PATCH /products/:id - Actualizar Producto

**URL**: `http://localhost:3000/products/{productId}`

**Body - Cambiar a Valor Custom**:

```json
{
  "attributes": [
    { "key": "brand", "value": "Nueva Marca Custom" },
    { "key": "model", "value": "Nuevo Modelo Custom" }
  ]
}
```

---

## 🔐 ENDPOINTS SUPERADMIN

### 5. POST /superadmin/products/create-for-tenant

**URL**: `http://localhost:3000/superadmin/products/create-for-tenant`

**Headers**:

```
Authorization: Bearer <SUPERADMIN_JWT_TOKEN>
Content-Type: application/json
```

**Body - Con Valor Custom**:

```json
{
  "tenantName": "tenant-name",
  "warehouseCountryCode": "US",
  "name": "Custom Laptop SuperAdmin",
  "category": "Computer",
  "attributes": [
    { "key": "brand", "value": "Mi Marca SuperAdmin" },
    { "key": "model", "value": "Modelo Especial SA" },
    { "key": "processor", "value": "Procesador Custom SA" },
    { "key": "ram", "value": "32GB Custom" },
    { "key": "storage", "value": "1TB Custom" },
    { "key": "screen", "value": "17 inch Custom" }
  ],
  "productCondition": "Optimal",
  "serialNumber": "SA-CUSTOM-001"
}
```

---

### 6. POST /superadmin/products/bulk-create-for-tenant

**URL**: `http://localhost:3000/superadmin/products/bulk-create-for-tenant`

**Body - Bulk con Custom Values**:

```json
{
  "tenantName": "tenant-name",
  "category": "Computer",
  "attributes": [
    { "key": "brand", "value": "Marca Bulk Custom" },
    { "key": "model", "value": "Modelo Bulk Custom" },
    { "key": "processor", "value": "Procesador Bulk" },
    { "key": "ram", "value": "16GB" },
    { "key": "storage", "value": "512GB" },
    { "key": "screen", "value": "15.6 inch" }
  ],
  "productCondition": "Optimal",
  "quantity": 3,
  "products": [
    { "warehouseCountryCode": "US", "serialNumber": "BULK-001" },
    { "warehouseCountryCode": "ES", "serialNumber": "BULK-002" },
    { "warehouseCountryCode": "MX", "serialNumber": "BULK-003" }
  ]
}
```

---

### 7. GET /superadmin/global-products

**URL**: `http://localhost:3000/superadmin/global-products`

**Resultado Esperado**: Lista de todos los productos sincronizados globalmente con custom values

---

## ✅ CASOS DE PRUEBA

| Caso | Descripción                   | Esperado           | Status |
| ---- | ----------------------------- | ------------------ | ------ |
| 1    | Crear con valor hardcodeado   | ✅ 201             | ⏳     |
| 2    | Crear con valor custom        | ✅ 201             | ⏳     |
| 3    | Crear con espacios/mayúsculas | ✅ 201             | ⏳     |
| 4    | Bulk con mix                  | ✅ 201             | ⏳     |
| 5    | Agrupamiento normalizado      | ✅ Agrupados       | ⏳     |
| 6    | Update con custom             | ✅ 200             | ⏳     |
| 7    | Valor vacío                   | ❌ 400             | ⏳     |
| 8    | SuperAdmin crear con custom   | ✅ 201             | ⏳     |
| 9    | SuperAdmin bulk con custom    | ✅ 201             | ⏳     |
| 10   | Global products sincronizados | ✅ Contiene custom | ⏳     |

---

## 🔍 VALIDACIONES A VERIFICAR

✅ **Debe Pasar**:

- Valores hardcodeados
- Valores custom
- Valores con espacios
- Valores con mayúsculas/minúsculas
- Mix de ambos
- SuperAdmin con custom values
- Sincronización global de custom values

❌ **Debe Fallar**:

- Valores vacíos
- Atributos faltantes requeridos
- Categoría inválida
- SuperAdmin sin token válido
