# 🔧 Public Quotes - Detalles Técnicos

## 1. Estructura de Datos

### Request DTO

```typescript
interface CreatePublicQuoteRequest {
  email: string; // Validado: email válido, no @firstplug.com
  fullName: string; // 2-100 chars, trim
  companyName: string; // 2-100 chars, trim
  country: string; // Código ISO (AR, BR, US, etc.)
  phone?: string; // Opcional, validado
  requestType: 'product' | 'service' | 'mixed'; // Tipo de solicitud
  products?: ProductData[]; // Array de productos (si requestType incluye 'product')
  services?: ServiceData[]; // Array de servicios (si requestType incluye 'service', EXCEPTO Offboarding)
}
```

### Productos Soportados

- Computer, Monitor, Audio, Peripherals, Merchandising
- Phone, Furniture, Tablet, Other

### Servicios Soportados

- IT Support, Enrollment, Data Wipe, Destruction and Recycling
- Buyback, Donate, Cleaning, Storage
- **NO**: Offboarding (solo usuarios logueados)

### Response DTO

```typescript
interface PublicQuoteResponse {
  message: string;
  quoteNumber: string; // PQR-{timestamp}-{random}
  createdAt: Date;
}
```

---

## 2. Generación de Números

### Algoritmo

```typescript
function generatePublicQuoteNumber(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PQR-${timestamp}-${random}`;
}
```

### Características

- ✅ Único: timestamp + random
- ✅ Ordenable: timestamp permite sorting
- ✅ Legible: formato corto
- ✅ Sin BD: no requiere persistencia

---

## 3. Validaciones Zod

### Email

- ✅ Formato válido (RFC 5322)
- ✅ NO emails de FirstPlug (@firstplug.com)
- ✅ Trim automático

### Nombre y Empresa

- ✅ 2-100 caracteres
- ✅ Trim automático
- ✅ No caracteres especiales peligrosos

### País

- ✅ Código ISO (AR, BR, etc.)
- ✅ O nombre completo (Argentina, Brazil)
- ✅ Conversión automática

### Teléfono (Opcional)

- ✅ Formato internacional
- ✅ 7-20 dígitos
- ✅ Caracteres permitidos: +, -, (), espacio

---

## 4. Rate Limiting

### Implementación

```typescript
// Usar @nestjs/throttler
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post('create')
async createPublicQuote() { ... }
```

### Configuración

- **Límite**: 10 requests por minuto
- **Por**: IP del cliente
- **Respuesta**: 429 Too Many Requests

---

## 5. Integración Slack

### Payload

```json
{
  "channel": "quotes",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Nueva Quote Pública*\n*Número*: PQR-...\n*Email*: ...\n*Empresa*: ..."
      }
    },
    { "type": "divider" },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "*Productos*: ..." }
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "*Servicios*: ..." }
    }
  ]
}
```

### Método

- ✅ Usar `SlackService.sendQuoteMessage()`
- ✅ No-blocking: catch errors, no throw
- ✅ Log errors pero continuar

---

## 6. Seguridad - Detalles

### CORS

- ✅ Permitir solo frontend configurado
- ✅ Métodos: POST
- ✅ Headers: Content-Type

### Validación

- ✅ Zod schema en controller
- ✅ Sanitización de inputs
- ✅ Validación de longitud

### Datos Sensibles

- ❌ NO retornar IDs internos
- ❌ NO retornar información de otros clientes
- ❌ NO loguear datos personales

### IP Tracking

- ✅ Rate limiting por IP
- ✅ Logs incluyen IP para debugging

---

## 7. Manejo de Errores

### Validación (400)

```
Email inválido
Nombre muy corto/largo
País no reconocido
```

### Rate Limit (429)

```
Demasiadas requests
```

### Slack (500)

```
Error enviando a Slack
(Pero quote se considera "creada" - no-blocking)
```

---

## 8. Logging

### Información a Loguear

- ✅ Número de quote generado
- ✅ Email del cliente (sin detalles)
- ✅ Timestamp
- ✅ IP del cliente
- ✅ Errores de validación

### NO Loguear

- ❌ Datos personales completos
- ❌ Información de otros clientes
- ❌ Detalles de productos/servicios
