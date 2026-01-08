# Offboarding Service - Quick Reference

## 📋 Estructura del Payload

```json
{
  "services": [
    {
      "serviceCategory": "Offboarding",
      "originMember": { ... },
      "isSensitiveSituation": boolean,
      "employeeKnows": boolean,
      "products": [ ... ],
      "additionalDetails": "string"
    }
  ]
}
```

---

## 🔑 Campos Requeridos

### originMember

```json
{
  "memberId": "string (ObjectId)",
  "firstName": "string",
  "lastName": "string",
  "email": "string (valid email)",
  "countryCode": "string (max 2 chars)"
}
```

### isSensitiveSituation

- Tipo: `boolean`
- Requerido: ✅
- Ejemplo: `false` o `true`

### employeeKnows

- Tipo: `boolean`
- Requerido: ✅
- Ejemplo: `true` o `false`

### desirablePickupDate

- Tipo: `Date` (ISO 8601 format: "YYYY-MM-DD")
- Requerido: ❌ (Opcional)
- Ejemplo: `"2025-01-15"`
- Descripción: Fecha deseable para el pickup de todos los productos

### products

- Tipo: `array`
- Mínimo: 1 producto
- Requerido: ✅

---

## 📦 Estructura de Producto

```json
{
  "productId": "string (ObjectId)",
  "productSnapshot": {
    "category": "string",
    "brand": "string",
    "model": "string",
    "serialNumber": "string",
    "location": "string",
    "assignedTo": "string",
    "assignedEmail": "string",
    "countryCode": "string"
  },
  "destination": { ... }
}
```

---

## 🎯 Tipos de Destino

### 1. Member (Reasignar a otro miembro)

```json
{
  "type": "Member",
  "memberId": "string (ObjectId)",
  "assignedMember": "string",
  "assignedEmail": "string (valid email)",
  "countryCode": "string (max 2 chars)"
}
```

### 2. Office (Enviar a oficina)

```json
{
  "type": "Office",
  "officeId": "string (ObjectId)",
  "officeName": "string",
  "countryCode": "string (max 2 chars)"
}
```

### 3. Warehouse (Enviar a warehouse)

```json
{
  "type": "Warehouse",
  "warehouseId": "string (ObjectId)",
  "warehouseName": "string",
  "countryCode": "string (max 2 chars)"
}
```

---

## 📝 Campos Opcionales

### additionalDetails

- Tipo: `string`
- Máximo: 1000 caracteres
- Ejemplo: "Almudena Cerezo está siendo offboardeada..."

---

## ✅ Validaciones

| Campo                    | Validación              | Error                            |
| ------------------------ | ----------------------- | -------------------------------- |
| serviceCategory          | Debe ser "Offboarding"  | Invalid service category         |
| originMember             | Requerido               | Origin member is required        |
| originMember.email       | Email válido            | Invalid email format             |
| originMember.countryCode | Max 2 chars             | Country code must be max 2 chars |
| isSensitiveSituation     | Boolean                 | Must be boolean                  |
| employeeKnows            | Boolean                 | Must be boolean                  |
| desirablePickupDate      | Date (optional)         | Valid ISO 8601 date format       |
| products                 | Array, min 1            | At least 1 product required      |
| products[].destination   | Requerido               | Destination is required          |
| destination.type         | Member/Office/Warehouse | Invalid destination type         |
| destination.countryCode  | Max 2 chars             | Country code must be max 2 chars |
| additionalDetails        | Max 1000 chars          | Max 1000 characters              |

---

## 🧪 Ejemplo Mínimo

```json
{
  "services": [
    {
      "serviceCategory": "Offboarding",
      "originMember": {
        "memberId": "686beb6f9c7a0951bbec40df",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@company.com",
        "countryCode": "US"
      },
      "isSensitiveSituation": false,
      "employeeKnows": true,
      "desirablePickupDate": "2025-01-15",
      "products": [
        {
          "productId": "686beb939c7a0951bbec4461",
          "productSnapshot": {
            "category": "Computer",
            "brand": "Apple",
            "model": "MacBook Pro",
            "serialNumber": "ABC123",
            "location": "Employee",
            "assignedTo": "John Doe",
            "assignedEmail": "john@company.com",
            "countryCode": "US"
          },
          "destination": {
            "type": "Member",
            "memberId": "507f1f77bcf86cd799439013",
            "assignedMember": "Jane Smith",
            "assignedEmail": "jane@company.com",
            "countryCode": "US"
          }
        }
      ]
    }
  ]
}
```

---

## 🔗 Documentación Relacionada

- **OFFBOARDING_REAL_EXAMPLE.md** - Caso real con Almudena Cerezo
- **OFFBOARDING_TEST_PAYLOAD.json** - JSON para Postman
- **TESTING_OFFBOARDING.md** - Guía de testing
- **PAYLOAD_EXAMPLES_MULTI_CATEGORY.md** - Ejemplos adicionales

---

## 🚀 Cómo Usar

1. Copiar estructura del ejemplo mínimo
2. Reemplazar valores con datos reales
3. Validar que todos los campos requeridos estén presentes
4. Enviar a `POST /quotes`
5. Verificar respuesta y Slack message

---

## 💡 Tips

- Siempre incluir `productSnapshot` completo
- Validar emails antes de enviar
- Country codes deben ser ISO 3166-1 alpha-2
- Mínimo 1 producto, máximo sin límite
- Cada producto debe tener un destino diferente o igual

---

**Última actualización:** 5 de Enero de 2025
