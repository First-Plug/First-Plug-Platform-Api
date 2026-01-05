# Testing Offboarding Service

## 📋 Requisitos Previos

1. **Backend corriendo:** `npm run start:dev`
2. **Base de datos:** Conectada y con datos de prueba
3. **Cliente HTTP:** Postman, Insomnia, o similar
4. **Token JWT:** Válido para autenticación

## 🧪 Pasos para Probar

### 1. Obtener el Payload de Prueba

El payload está en: `src/quotes/docs/OFFBOARDING_TEST_PAYLOAD.json`

```json
{
  "services": [
    {
      "serviceCategory": "Offboarding",
      "originMember": {
        "memberId": "686beb6f9c7a0951bbec40df",
        "firstName": "Almudena",
        "lastName": "Cerezo",
        "email": "almudenacerezo@work.com",
        "countryCode": "UY"
      },
      "isSensitiveSituation": false,
      "employeeKnows": true,
      "desirablePickupDate": "2025-01-15",
      "products": [
        // ... 3 productos con diferentes destinos
      ],
      "additionalDetails": "..."
    }
  ]
}
```

### 2. Crear Quote con Offboarding Service

**Endpoint:** `POST /quotes`

**Headers:**

```
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json
```

**Body:** Copiar el payload completo de `OFFBOARDING_TEST_PAYLOAD.json`

**Respuesta Esperada (201):**

```json
{
  "_id": "...",
  "requestId": "REQ-2025-...",
  "requestType": "Quote",
  "status": "Requested",
  "services": [
    {
      "serviceCategory": "Offboarding",
      "originMember": { ... },
      "isSensitiveSituation": false,
      "employeeKnows": true,
      "products": [ ... ],
      "additionalDetails": "..."
    }
  ],
  "createdAt": "2025-01-05T...",
  "updatedAt": "2025-01-05T..."
}
```

### 3. Verificar Slack Message

**Esperado:** Mensaje en Slack con:

- ✅ Origin Member: Almudena Cerezo (almudenacerezo@work.com) - UY
- ✅ Is Sensitive Situation: No
- ✅ Employee Knows: Yes
- ✅ Total quantity of products: 3
- ✅ Product 1: LG Smart Monitor → Evelio Farias (eveliofarias@work.com) - ES
- ✅ Product 2: Apple iPhone 15 Pro → Oficina Principal - GT
- ✅ Product 3: Logitech M240 Mouse → Uruguay Central Warehouse - UY

### 4. Verificar History Record

**Endpoint:** `GET /history?itemType=quotes`

**Esperado:** Registro con:

- ✅ actionType: "create"
- ✅ itemType: "quotes"
- ✅ changes.newData.services[0].serviceCategory: "Offboarding"
- ✅ changes.newData.services[0].originMember: { ... }
- ✅ changes.newData.services[0].isSensitiveSituation: false
- ✅ changes.newData.services[0].employeeKnows: true
- ✅ changes.newData.services[0].productCount: 3
- ✅ changes.newData.services[0].products: [ ... ]

## 🔍 Validaciones a Verificar

### Validación de Campos Obligatorios

- ✅ serviceCategory debe ser "Offboarding"
- ✅ originMember es requerido
- ✅ isSensitiveSituation es requerido (boolean)
- ✅ employeeKnows es requerido (boolean)
- ✅ products es requerido (mínimo 1)

### Validación de Email

- ✅ Email de originMember debe ser válido
- ✅ Email de destino (si es Member) debe ser válido

### Validación de Country Code

- ✅ Country code debe ser máximo 2 caracteres
- ✅ Todos los country codes deben ser válidos

### Validación de Destino

- ✅ Cada producto debe tener un destino
- ✅ Destino debe ser uno de: Member, Office, Warehouse
- ✅ Campos requeridos según tipo de destino

## 🧪 Casos de Prueba Adicionales

### Caso 1: Situación Sensible

```json
{
  "isSensitiveSituation": true,
  "employeeKnows": false,
  "additionalDetails": "Terminación por causa. Recuperar equipos inmediatamente."
}
```

### Caso 2: Un Solo Producto

```json
{
  "products": [
    {
      "productId": "686beb939c7a0951bbec4461",
      "productSnapshot": { ... },
      "destination": { "type": "Member", ... }
    }
  ]
}
```

### Caso 3: Todos los Productos a Warehouse

```json
{
  "products": [
    { "destination": { "type": "Warehouse", ... } },
    { "destination": { "type": "Warehouse", ... } },
    { "destination": { "type": "Warehouse", ... } }
  ]
}
```

## 📊 Checklist de Prueba

- [ ] Quote creado exitosamente
- [ ] Mensaje enviado a Slack
- [ ] Registro creado en History
- [ ] Todos los campos se muestran correctamente en Slack
- [ ] Todos los campos se registran en History
- [ ] Validaciones funcionan correctamente
- [ ] Errores se manejan apropiadamente

## 🐛 Debugging

Si algo falla:

1. **Revisar logs del backend:**

   ```
   npm run start:dev
   ```

2. **Verificar validaciones Zod:**

   - Revisar `src/quotes/validations/service.zod.ts`

3. **Verificar Slack message:**

   - Revisar `src/quotes/helpers/create-quote-message-to-slack.ts`

4. **Verificar History recording:**
   - Revisar `src/quotes/quotes-coordinator.service.ts`

## ✅ Resultado Esperado

Después de completar todas las pruebas, deberías tener:

- ✅ Quote creado en BD
- ✅ Mensaje en Slack con todos los detalles
- ✅ Registro en History con toda la información
- ✅ Validaciones funcionando correctamente
