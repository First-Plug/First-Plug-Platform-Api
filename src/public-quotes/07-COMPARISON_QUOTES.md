# 📊 Comparación: Quotes Logueadas vs Quotes Públicas

## Tabla Comparativa

| Característica            | Quotes Logueadas                  | Quotes Públicas                       |
| ------------------------- | --------------------------------- | ------------------------------------- |
| **URL**                   | `/api/quotes`                     | `/api/public-quotes`                  |
| **Autenticación**         | ✅ JWT Guard                      | ❌ Sin autenticación                  |
| **Middleware Tenant**     | ✅ TenantsMiddleware              | ❌ Sin middleware                     |
| **Persistencia BD**       | ✅ Guardadas                      | ❌ NO se guardan                      |
| **Tenant**                | ✅ Asociadas a tenant             | ❌ Sin tenant                         |
| **Numeración**            | `QR-{tenantName}-{autoIncrement}` | `PQR-{timestamp}-{random}`            |
| **Datos Requeridos**      | Email, nombre                     | Email, nombre, empresa, país          |
| **Teléfono**              | ❌ No                             | ✅ Opcional                           |
| **requestType**           | ✅ Sí                             | ✅ Sí ('product'\|'service'\|'mixed') |
| **Servicios Disponibles** | Todos (incluye Offboarding)       | 8 servicios (SIN Offboarding)         |
| **Destino**               | ✅ BD + Slack                     | ✅ Solo Slack                         |
| **Módulo**                | `QuotesModule`                    | `PublicQuotesModule`                  |
| **Servicio Raíz**         | `QuotesService`                   | `PublicQuotesService`                 |
| **Coordinador**           | `QuotesCoordinatorService`        | `PublicQuotesCoordinatorService`      |
| **Rate Limiting**         | ❌ No                             | ✅ 10 req/min                         |
| **Validación**            | ✅ Zod                            | ✅ Zod (diferente)                    |
| **Reutilización**         | -                                 | SlackService, interfaces              |

---

## Flujos Comparados

### Quotes Logueadas

```
1. Usuario logueado accede a /quotes
2. JWT Guard valida token
3. TenantsMiddleware resuelve tenant
4. Controller recibe datos
5. QuotesCoordinatorService orquesta:
   ├─ QuotesService.create() → Guarda en BD
   ├─ SlackService.sendQuoteMessage() → Notifica
   └─ HistoryService.record() → Registra
6. Retorna quote con ID de BD
```

### Quotes Públicas

```
1. Cliente potencial accede a URL pública
2. NO hay JWT Guard
3. NO hay TenantsMiddleware
4. Rate Limiting valida IP
5. Validación Zod valida datos
6. PublicQuotesCoordinatorService orquesta:
   ├─ PublicQuotesService.generateNumber() → PQR
   ├─ PublicQuotesService.preparePayload() → Datos
   └─ SlackService.sendQuoteMessage() → Notifica
7. Retorna confirmación con número PQR
```

---

## Datos Enviados a Slack

### Quotes Logueadas

```json
{
  "requestId": "QR-tenant_name-000001",
  "tenantName": "tenant_name",
  "userEmail": "user@company.com",
  "userName": "Juan Pérez",
  "products": [...],
  "services": [...]
}
```

### Quotes Públicas

```json
{
  "quoteNumber": "PQR-1705123456789-A7K2",
  "email": "cliente@empresa.com",
  "fullName": "Juan Pérez",
  "companyName": "Empresa XYZ",
  "country": "AR",
  "phone": "+54 9 11 1234-5678",
  "requestType": "mixed",
  "products": [...],
  "services": [...]
}
```

---

## Seguridad

### Quotes Logueadas

- ✅ JWT Guard
- ✅ TenantsMiddleware
- ✅ Acceso a datos de tenant
- ✅ Auditoría en HistoryService

### Quotes Públicas

- ✅ Rate Limiting (10 req/min)
- ✅ Validación Zod estricta
- ✅ Sanitización de inputs
- ✅ NO exponer datos internos
- ✅ NO acceso a BD
- ✅ NO acceso a tenant

---

## Reutilización de Código

### ✅ Reutilizar

- `SlackService.sendQuoteMessage()`
- Interfaces de productos/servicios
- Helpers de país (countryCodes)
- Schemas de validación (adaptar)

### ❌ NO Reutilizar

- `QuotesService` (lógica diferente)
- `QuotesCoordinatorService` (flujo diferente)
- `QuotesController` (endpoints diferentes)
- Middleware de tenant
- JWT Guard

---

## Decisión: ¿Por qué módulo separado?

### Razones

1. **Flujos completamente diferentes**: BD vs no-BD
2. **Seguridad diferente**: JWT vs Rate Limiting
3. **Datos diferentes**: Estructura diferente
4. **Numeración diferente**: QR vs PQR
5. **Escalabilidad**: Cambios futuros sin afectar quotes logueadas
6. **Claridad**: Código más limpio y mantenible

### Alternativa Rechazada

Reutilizar `QuotesModule` con flags:

- ❌ Acoplamiento innecesario
- ❌ Lógica condicional compleja
- ❌ Difícil de mantener
- ❌ Riesgo de bugs
