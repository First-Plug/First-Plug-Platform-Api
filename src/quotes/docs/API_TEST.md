# 🧪 Quotes API - Testing Guide

## ✅ Requisitos Previos

1. **Servidor corriendo**: `npm run start:dev`
2. **JWT Token válido**: Obtener token del login
3. **Tenant existente**: Usar un tenant válido
4. **RapidAPI o Postman**: Para hacer las requests

---

## 📍 Endpoint POST - Crear Quote

```
POST http://localhost:3000/quotes
```

### Headers Requeridos

```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

### Payload de Ejemplo

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
      "screenSize": ["13.3 inch", "15.6 inch"],
      "otherSpecifications": "Touchscreen, Backlit keyboard",
      "extendedWarranty": true,
      "extendedWarrantyYears": 3,
      "deviceEnrollment": true,
      "country": "US",
      "city": "New York",
      "deliveryDate": "2025-01-15",
      "comments": "Urgent delivery needed"
    }
  ]
}
```

---

## 📊 Respuesta Esperada (201 Created)

```json
{
  "_id": "67a1b2c3d4e5f6g7h8i9j0k1",
  "requestId": "QR-tenant-name-001",
  "tenantId": "507f1f77bcf86cd799439011",
  "tenantName": "tenant-name",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "requestType": "Comprar productos",
  "products": [...],
  "isDeleted": false,
  "createdAt": "2025-01-12T10:30:00.000Z",
  "updatedAt": "2025-01-12T10:30:00.000Z"
}
```

---

## 🔍 Verificar en MongoDB

```
Database: tenant_{tenantName}
Collection: quotes
```

---

## 📋 Otros Endpoints

### GET - Listar Quotes
```
GET http://localhost:3000/quotes
Authorization: Bearer {JWT_TOKEN}
```

### GET - Obtener Quote por ID
```
GET http://localhost:3000/quotes/{quoteId}
Authorization: Bearer {JWT_TOKEN}
```

### PATCH - Actualizar Quote
```
PATCH http://localhost:3000/quotes/{quoteId}
Authorization: Bearer {JWT_TOKEN}
```

### DELETE - Cancelar Quote
```
DELETE http://localhost:3000/quotes/{quoteId}
Authorization: Bearer {JWT_TOKEN}
```

---

## 🎯 Qué se crea automáticamente

✅ Colección `quotes` en `tenant_{tenantName}`
✅ RequestId único: `QR-{tenantName}-{autoIncrement}`
✅ Registro en History
✅ Notificación en Slack
✅ Timestamps (createdAt, updatedAt)

