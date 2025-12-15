# 📋 Ejemplos de Payloads para Quotes API

## 🎯 Contexto

Un **Quote** es una **cotización de compra de computadoras**.

El usuario final está pidiendo un presupuesto para comprar computadoras con especificaciones específicas.

**NO incluye:**

- ❌ Serial numbers (eso es para productos ya comprados)
- ❌ Condiciones (Optimal, Defective, etc - eso es para inventario)
- ❌ Ubicaciones de almacén (eso es para logística)

**SÍ incluye:**

- ✅ Especificaciones deseadas (OS, RAM, Storage, etc)
- ✅ Cantidad de unidades
- ✅ Opciones adicionales (Extended Warranty, Device Enrollment)
- ✅ Datos de entrega (país, ciudad, fecha)
- ✅ Comentarios especiales

---

## 📝 Payload Mínimo (Solo Obligatorios)

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 2,
      "country": "US"
    }
  ]
}
```

**Campos Obligatorios:**

- `category`: "Computer" (fijo en MVP)
- `quantity`: número entero positivo
- `country`: código ISO de 2 caracteres (US, MX, AR, etc)

---

## 📝 Payload Completo (Recomendado)

```json
{
  "products": [
    {
      "category": "Computer",
      "os": "Windows",
      "quantity": 5,
      "brand": ["Dell", "HP"],
      "model": ["XPS 13", "Pavilion 15"],
      "processor": ["Intel i7", "AMD Ryzen 7"],
      "ram": ["16GB", "32GB"],
      "storage": ["512GB SSD", "1TB SSD"],
      "screenSize": ["13 inch", "15 inch"],
      "otherSpecifications": "Preferencia por pantalla mate, teclado retroiluminado",
      "extendedWarranty": true,
      "extendedWarrantyYears": 3,
      "deviceEnrollment": true,
      "country": "US",
      "city": "New York",
      "deliveryDate": "2025-02-15T00:00:00Z",
      "comments": "Entrega urgente, necesitamos antes del 15 de febrero"
    }
  ]
}
```

---

## 📝 Payload Múltiples Productos

```json
{
  "products": [
    {
      "category": "Computer",
      "os": "macOS",
      "quantity": 3,
      "brand": ["MacBook Pro"],
      "processor": ["M3 Pro"],
      "ram": ["16GB"],
      "storage": ["512GB SSD"],
      "screenSize": ["14 inch"],
      "extendedWarranty": true,
      "extendedWarrantyYears": 2,
      "country": "US",
      "city": "San Francisco",
      "deliveryDate": "2025-02-01T00:00:00Z"
    },
    {
      "category": "Computer",
      "os": "Windows",
      "quantity": 10,
      "brand": ["Dell"],
      "model": ["OptiPlex 7000"],
      "processor": ["Intel i5"],
      "ram": ["8GB"],
      "storage": ["256GB SSD"],
      "country": "US",
      "city": "Los Angeles",
      "comments": "Para oficina, no necesita warranty extendida"
    }
  ]
}
```

---

## 📊 Campos Explicados

| Campo                   | Tipo     | Obligatorio | Descripción                                             |
| ----------------------- | -------- | ----------- | ------------------------------------------------------- |
| `category`              | String   | ✅          | Siempre "Computer" en MVP                               |
| `os`                    | String   | ❌          | macOS, Windows o Linux                                  |
| `quantity`              | Number   | ✅          | Cantidad de unidades (mín 1)                            |
| `brand`                 | String[] | ❌          | Marcas deseadas (ej: ["Dell", "HP"])                    |
| `model`                 | String[] | ❌          | Modelos deseados                                        |
| `processor`             | String[] | ❌          | Procesadores deseados                                   |
| `ram`                   | String[] | ❌          | RAM deseada (ej: ["16GB", "32GB"])                      |
| `storage`               | String[] | ❌          | Almacenamiento deseado                                  |
| `screenSize`            | String[] | ❌          | Tamaño de pantalla deseado                              |
| `otherSpecifications`   | String   | ❌          | Especificaciones adicionales                            |
| `extendedWarranty`      | Boolean  | ❌          | ¿Incluir garantía extendida?                            |
| `extendedWarrantyYears` | Number   | ⚠️          | Años de garantía (obligatorio si extendedWarranty=true) |
| `deviceEnrollment`      | Boolean  | ❌          | ¿Incluir Device Enrollment?                             |
| `country`               | String   | ✅          | Código ISO (US, MX, AR, etc)                            |
| `city`                  | String   | ❌          | Ciudad de entrega                                       |
| `deliveryDate`          | String   | ❌          | Fecha ISO 8601 (ej: "2025-02-15T00:00:00Z")             |
| `comments`              | String   | ❌          | Comentarios especiales                                  |

---

## ✅ Respuesta Exitosa (201 Created)

```json
{
  "_id": "67a1b2c3d4e5f6g7h8i9j0k3",
  "requestId": "QR-acme-000001",
  "tenantId": "67a1b2c3d4e5f6g7h8i9j0k4",
  "tenantName": "acme",
  "userName": "John Doe",
  "userEmail": "john@acme.com",
  "requestType": "Comprar productos",
  "products": [
    {
      "category": "Computer",
      "os": "Windows",
      "quantity": 5,
      "brand": ["Dell", "HP"],
      "model": ["XPS 13", "Pavilion 15"],
      "processor": ["Intel i7", "AMD Ryzen 7"],
      "ram": ["16GB", "32GB"],
      "storage": ["512GB SSD", "1TB SSD"],
      "screenSize": ["13 inch", "15 inch"],
      "otherSpecifications": "Preferencia por pantalla mate",
      "extendedWarranty": true,
      "extendedWarrantyYears": 3,
      "deviceEnrollment": true,
      "country": "US",
      "city": "New York",
      "deliveryDate": "2025-02-15T00:00:00Z",
      "comments": "Entrega urgente"
    }
  ],
  "isDeleted": false,
  "createdAt": "2024-12-15T10:30:00.000Z",
  "updatedAt": "2024-12-15T10:30:00.000Z"
}
```

---

## 🚀 Cómo Probar en RapidAPI/Postman

```
POST http://localhost:3001/api/quotes
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

Body: (Copia uno de los payloads de arriba)
```

---

## 📌 Notas Importantes

1. **No incluyas productId** - Las quotes son presupuestos, no referencias a productos existentes
2. **No incluyas serialNumber** - Eso es para productos ya comprados
3. **No incluyas condition** - Eso es para inventario (Optimal, Defective, etc)
4. **Usa "Computer" no "Computers"** - Singular, como en el schema
5. **Arrays de strings** - brand, model, processor, etc son arrays para permitir múltiples opciones
6. **Validación condicional** - Si `extendedWarranty=true`, entonces `extendedWarrantyYears` es obligatorio
