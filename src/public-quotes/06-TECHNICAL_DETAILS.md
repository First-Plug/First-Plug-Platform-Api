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
- Offboarding, Logistics
- **Nota**: Todos disponibles sin productos pre-cargados

### Response DTO

```typescript
interface PublicQuoteResponse {
  message: string;
  quoteNumber: string; // PQR-{timestamp}-{random}
  createdAt: Date;
}
```

### Persistencia en BD Superior (Auditoría y Control)

**Propósito**: Verificación manual de integridad - contar documentos en BD y compararlos con mensajes en Slack.

**Fase 1**: Sin UI SuperAdmin - solo persistencia para validación manual.

```typescript
// Documento guardado en BD superior (firstPlug.quotes en dev / main.quotes en prod)
interface PublicQuoteDocument {
  _id: ObjectId;

  // Datos del cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: ProductData[];
  services?: ServiceData[];

  // Metadata
  quoteNumber: string; // PQR-{timestamp}-{random}
  status: 'received' | 'reviewed' | 'responded';
  notes?: string; // Notas del super admin

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
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

## 8. Persistencia en BD Superior (firstPlug.quotes)

### Flujo de Guardado

```
1. Validar datos (Zod)
2. Generar número PQR
3. Guardar en firstPlug.quotes
   ├─ Crear documento con todos los datos
   ├─ Establecer status = 'received'
   └─ Crear índices para búsqueda
4. Enviar a Slack (no-blocking)
5. Retornar confirmación
```

### Índices Recomendados

```typescript
// En firstPlug.quotes
db.quotes.createIndex({ createdAt: -1 }); // Para ordenamiento
db.quotes.createIndex({ email: 1 }); // Para búsqueda por email
db.quotes.createIndex({ country: 1 }); // Para filtrado por país
db.quotes.createIndex({ requestType: 1 }); // Para filtrado por tipo
db.quotes.createIndex({ status: 1 }); // Para filtrado por estado
db.quotes.createIndex({ createdAt: -1, status: 1 }); // Compuesto
```

### Acceso SuperAdmin

```typescript
// SuperAdmin endpoints
GET    /super-admin/public-quotes              // Listar todas
GET    /super-admin/public-quotes/:id          // Detalle
PUT    /super-admin/public-quotes/:id          // Actualizar estado/notas
DELETE /super-admin/public-quotes/:id          // Archivar

// Requiere JWT con rol 'superadmin'
```

---

## 9. Logging

### Información a Loguear

- ✅ Número de quote generado
- ✅ Email del cliente (sin detalles)
- ✅ Timestamp
- ✅ IP del cliente
- ✅ Errores de validación
- ✅ Guardado en BD (éxito/error)

### NO Loguear

- ❌ Datos personales completos
- ❌ Información de otros clientes
- ❌ Detalles de productos/servicios
