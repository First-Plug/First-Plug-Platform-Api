# 📦 PAYLOADS CORRECTOS - Crear Productos con Oficinas

## 🎯 REGLAS DE VALIDACIÓN

### Cuando `location` = "Our office"
**REQUERIDO**:
- ✅ `country`: Código del país (ej: "US", "ES", "MX", "AR")
- ✅ `officeName`: Nombre de la oficina (ej: "Main Office", "Oficina Central")

### Cuando `location` = "Employee"
**REQUERIDO**:
- ✅ `assignedEmail`: Email del empleado

**NO PERMITIDO**:
- ❌ `country`
- ❌ `officeName`

### Cuando `location` = "FP warehouse"
**REQUERIDO** (solo en CSV):
- ✅ `country`: Código del país

**NO PERMITIDO**:
- ❌ `officeName`

---

## 📋 PAYLOADS CORRECTOS

### 1️⃣ Crear Producto en Oficina (Our office)

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
  "officeName": "New York Office",
  "status": "Available",
  "productCondition": "Optimal"
}
```

---

### 2️⃣ Crear Producto con Valor Custom en Oficina

```json
{
  "category": "Computer",
  "name": "Mi Laptop Custom",
  "attributes": [
    { "key": "brand", "value": "Mi Marca Personalizada" },
    { "key": "model", "value": "Modelo Único" },
    { "key": "processor", "value": "Procesador Especial" },
    { "key": "ram", "value": "32GB Custom" },
    { "key": "storage", "value": "2TB Custom" },
    { "key": "screen", "value": "17.5 inch Custom" }
  ],
  "location": "Our office",
  "country": "ES",
  "officeName": "Oficina Madrid",
  "status": "Available",
  "productCondition": "Optimal"
}
```

---

### 3️⃣ Asignar Producto a Empleado

```json
{
  "category": "Computer",
  "name": "Laptop Asignada",
  "attributes": [
    { "key": "brand", "value": "Dell" },
    { "key": "model", "value": "XPS 13" },
    { "key": "processor", "value": "Intel Core i7" },
    { "key": "ram", "value": "16GB" },
    { "key": "storage", "value": "512GB SSD" },
    { "key": "screen", "value": "13.3 inch" }
  ],
  "location": "Employee",
  "assignedEmail": "employee@company.com",
  "status": "Delivered",
  "productCondition": "Optimal"
}
```

---

### 4️⃣ Bulk Create - Mix de Oficinas y Empleados

```json
[
  {
    "category": "Computer",
    "name": "MacBook - Oficina NY",
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
    "name": "Dell - Asignada a Juan",
    "attributes": [
      { "key": "brand", "value": "Dell" },
      { "key": "model", "value": "XPS 15" },
      { "key": "processor", "value": "Intel Core i7" },
      { "key": "ram", "value": "16GB" },
      { "key": "storage", "value": "512GB SSD" },
      { "key": "screen", "value": "15.6 inch" }
    ],
    "location": "Employee",
    "assignedEmail": "juan@company.com",
    "status": "Delivered",
    "productCondition": "Optimal"
  },
  {
    "category": "Computer",
    "name": "Custom - Oficina Madrid",
    "attributes": [
      { "key": "brand", "value": "Mi Marca Custom" },
      { "key": "model", "value": "Modelo Especial" },
      { "key": "processor", "value": "Procesador Custom" },
      { "key": "ram", "value": "32GB" },
      { "key": "storage", "value": "1TB" },
      { "key": "screen", "value": "17 inch" }
    ],
    "location": "Our office",
    "country": "ES",
    "officeName": "Oficina Madrid",
    "status": "Available",
    "productCondition": "Optimal"
  }
]
```

---

## ❌ PAYLOADS INCORRECTOS

### ❌ Falta country y officeName en "Our office"
```json
{
  "location": "Our office",
  "category": "Computer",
  ...
  // ❌ FALTA: country, officeName
}
```

### ❌ Incluye country/officeName en "Employee"
```json
{
  "location": "Employee",
  "assignedEmail": "user@company.com",
  "country": "US",  // ❌ NO PERMITIDO
  "officeName": "Office",  // ❌ NO PERMITIDO
  ...
}
```

### ❌ Falta assignedEmail en "Employee"
```json
{
  "location": "Employee",
  // ❌ FALTA: assignedEmail
  ...
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Crear en "Our office" con country + officeName
- [ ] Crear en "Employee" con assignedEmail
- [ ] Bulk create con mix de ubicaciones
- [ ] Verificar que custom values se guardan
- [ ] Verificar agrupamiento normalizado
- [ ] Verificar sincronización global


