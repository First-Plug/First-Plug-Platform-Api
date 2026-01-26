# ❓ [9/10] Preguntas Frecuentes - Email Service

## 1️⃣ ESTADÍSTICAS DE EMAILS

### ¿Qué estadísticas puedo obtener?

**Resend proporciona**:

- ✅ **Delivered**: Email entregado al servidor
- ✅ **Opened**: Usuario abrió el email
- ✅ **Clicked**: Usuario hizo clic en un link
- ✅ **Bounced**: Email rechazado
- ✅ **Complained**: Usuario marcó como spam
- ✅ **Unsubscribed**: Usuario se desuscribió

### ¿Cómo obtengo estas estadísticas?

**Opción 1: Webhooks (Recomendado)**

```typescript
// Resend envía eventos a tu endpoint
POST /webhooks/email-events
{
  "type": "email.opened",
  "data": {
    "email_id": "abc123",
    "email": "user@example.com",
    "timestamp": "2026-01-12T10:30:00Z"
  }
}
```

**Opción 2: API de Resend**

```typescript
// Consultar estado de un email
const email = await resend.emails.get('email_id');
// Retorna: { status: 'delivered', opened: true, clicked: true }
```

**Opción 3: Dashboard de Resend**

- Acceso web a estadísticas en tiempo real
- Gráficos de deliverability
- Análisis por template

### ¿Cómo almaceno estas estadísticas?

**Crear tabla en BD**:

```typescript
interface EmailEvent {
  id: ObjectId;
  emailId: string; // ID de Resend
  tenantId: ObjectId;
  to: string;
  template: string;
  event: 'sent' | 'opened' | 'clicked' | 'bounced' | 'complained';
  timestamp: Date;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    linkClicked?: string;
  };
}
```

**Implementación**:

```typescript
@Injectable()
export class EmailEventService {
  async recordEvent(event: EmailEvent) {
    await this.emailEventModel.create(event);
  }

  async getStats(tenantId, templateName) {
    return {
      sent: await this.count({ template: templateName, event: 'sent' }),
      opened: await this.count({ template: templateName, event: 'opened' }),
      clicked: await this.count({ template: templateName, event: 'clicked' }),
      bounced: await this.count({ template: templateName, event: 'bounced' }),
      openRate: (opened / sent) * 100,
      clickRate: (clicked / sent) * 100,
    };
  }
}
```

---

## 2️⃣ TEMPLATES: ¿DÓNDE SE CREAN?

### Respuesta Corta

**Los templates se crean EN TU APLICACIÓN**, no en Resend.

### Explicación Detallada

**Opción 1: Templates en tu código (RECOMENDADO)**

```typescript
// src/email/templates/shipment-created.template.ts
export class ShipmentCreatedTemplate {
  render(data: { shipment: any; user: any }): string {
    return `
      <h1>Shipment Created</h1>
      <p>Hi ${data.user.name},</p>
      <p>Your shipment #${data.shipment.id} was created.</p>
    `;
  }
}
```

**Ventajas**:

- ✅ Control total del contenido
- ✅ Versionado con tu código
- ✅ Fácil de testear
- ✅ Cambios sin salir de tu app

**Opción 2: Templates en Resend (Opcional)**

```typescript
// Resend tiene "Email Templates" en su dashboard
// Pero es más complejo de mantener
// NO RECOMENDADO para desarrollo ágil
```

**Opción 3: Híbrido (Avanzado)**

```typescript
// Guardar templates en BD
interface EmailTemplate {
  name: string;
  subject: string;
  htmlContent: string; // HTML con variables {{name}}, {{id}}
  version: number;
}

// Renderizar con variables
const html = template.htmlContent
  .replace('{{name}}', user.name)
  .replace('{{id}}', shipment.id);
```

### ¿Qué formato usan los templates?

**HTML puro** (lo más simple):

```html
<h1>Hello {{name}}</h1>
<p>Your order #{{orderId}} is ready</p>
<a href="{{link}}">View Details</a>
```

**Con Handlebars** (más potente):

```handlebars
<h1>Hello {{user.name}}</h1>
{{#if shipment.status}}
  <p>Status: {{shipment.status}}</p>
{{/if}}
```

**Con JSX** (si usas React):

```typescript
export const ShipmentTemplate = ({ shipment, user }) => (
  <div>
    <h1>Shipment Created</h1>
    <p>Hi {user.name},</p>
    <p>Your shipment #{shipment.id} is ready</p>
  </div>
);
```

### Flujo Completo

```
Tu Aplicación
    ↓
EmailService.sendImmediate(to, 'shipment-created', data)
    ↓
Template.render(data)  ← Aquí se genera el HTML
    ↓
Resend API
    ↓
Email enviado
```

---

## 3️⃣ RESUMEN RÁPIDO

| Pregunta                  | Respuesta                        |
| ------------------------- | -------------------------------- |
| ¿Dónde creo templates?    | En tu código (recomendado)       |
| ¿Qué formato?             | HTML puro o Handlebars           |
| ¿Estadísticas?            | Webhooks de Resend + tabla en BD |
| ¿Cómo obtengo "opened"?   | Webhook cuando usuario abre      |
| ¿Cómo obtengo "clicked"?  | Webhook cuando usuario hace clic |
| ¿Puedo trackear acciones? | Sí, con webhooks + BD            |

---

## 4️⃣ IMPLEMENTACIÓN RÁPIDA

**Paso 1: Crear template**

```typescript
// src/email/templates/user-enabled.template.ts
export class UserEnabledTemplate {
  subject() {
    return 'Welcome to FirstPlug';
  }

  html(data) {
    return `<h1>Welcome ${data.user.name}</h1>`;
  }
}
```

**Paso 2: Usar en servicio**

```typescript
await this.emailService.sendImmediate(user.email, 'user-enabled', { user });
```

**Paso 3: Recibir webhooks**

```typescript
@Post('/webhooks/email-events')
async handleEmailEvent(@Body() event: any) {
  await this.emailEventService.recordEvent(event);
}
```

**Paso 4: Consultar estadísticas**

```typescript
const stats = await this.emailEventService.getStats(tenantId, 'user-enabled');
// { sent: 100, opened: 45, clicked: 12, openRate: 45% }
```

---

## 4️⃣ HERRAMIENTAS: ¿QUÉ SON Y TIENEN COSTO?

### Bull (Queue System)

**¿Qué es?**

- Librería para procesar tareas en background
- Usa Redis como almacenamiento
- Maneja reintentos automáticos

**¿Tiene costo?**

- ✅ **Bull es GRATIS** (open source)
- ⚠️ **Redis sí tiene costo** (si usas servicio cloud)

**Opciones Redis**:

- **Local** (desarrollo): Gratis, instalas en tu máquina
- **Redis Cloud**: $7/mes (plan básico)
- **AWS ElastiCache**: ~$15/mes
- **Upstash**: $0 (free tier generoso)

**Alternativa sin costo**: Usar Bull con SQLite en desarrollo

---

### @nestjs/schedule (Cron Jobs)

**¿Qué es?**

- Librería para ejecutar tareas en horarios específicos
- Integrada con NestJS
- Ejemplos: "cada lunes a las 10:08", "cada día a las 9:00"

**¿Tiene costo?**

- ✅ **GRATIS** (open source)
- No requiere infraestructura adicional
- Se ejecuta en tu servidor

**Limitación**:

- Solo funciona si tu servidor está corriendo
- Si necesitas garantía 24/7, considera servicios como:
  - AWS Lambda (pago por uso)
  - Google Cloud Scheduler ($0.10 por millón de invocaciones)

---

## 5️⃣ RESPONSIVE DESIGN (IMPORTANTE)

### Templates HTML Responsive

**Problema**: Emails que se ven mal en móvil

**Solución**: Usar CSS responsive + tablas anidadas

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      .header {
        background: #4c83ee;
        color: white;
        padding: 20px;
        text-align: center;
      }
      .content {
        padding: 20px;
      }
      .button {
        display: inline-block;
        background: #22d172;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 4px;
        margin: 10px 0;
      }
      @media (max-width: 600px) {
        .container {
          width: 100%;
        }
        .content {
          padding: 10px;
        }
        .button {
          width: 100%;
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Shipment Created</h1>
      </div>
      <div class="content">
        <p>Hi {{user.name}},</p>
        <p>Your shipment #{{shipment.id}} was created.</p>
        <a href="{{link}}" class="button">View Details</a>
      </div>
    </div>
  </body>
</html>
```

**Ventajas**:

- ✅ Se ve bien en desktop, tablet, móvil
- ✅ Funciona en todos los clientes de email
- ✅ Sin dependencias externas

---

## 6️⃣ ESTADÍSTICAS: ¿GUARDAR EN BD O NO?

### Opción 1: Solo Resend (Recomendado para MVP)

**Ventajas**:

- ✅ No ocupas espacio en BD
- ✅ Resend mantiene datos 90 días
- ✅ Dashboard bonito en Resend
- ✅ Más rápido

**Desventajas**:

- ❌ Datos desaparecen después de 90 días
- ❌ No puedes hacer queries complejas
- ❌ Dependencia de Resend

**Implementación**:

```typescript
// Consultar en Resend cuando necesites
const email = await resend.emails.get('email_id');
console.log(email.status); // 'delivered', 'opened', etc
```

---

### Opción 2: Guardar en BD (Recomendado para producción)

**Ventajas**:

- ✅ Datos permanentes
- ✅ Queries complejas (reportes, analytics)
- ✅ Independencia de Resend
- ✅ Auditoría completa

**Desventajas**:

- ❌ Ocupas espacio en BD
- ❌ Más código

**Implementación**:

```typescript
// Recibir webhook de Resend
@Post('/webhooks/email-events')
async handleEvent(@Body() event: any) {
  await this.emailEventModel.create({
    emailId: event.data.email_id,
    event: event.type, // 'opened', 'clicked', etc
    timestamp: new Date(),
  });
}

// Consultar después
const stats = await this.emailEventModel.aggregate([
  { $match: { template: 'shipment-created' } },
  { $group: {
    _id: '$event',
    count: { $sum: 1 }
  }}
]);
// { _id: 'opened', count: 45 }
// { _id: 'clicked', count: 12 }
```

**Recomendación**: Opción 1 para MVP, Opción 2 cuando crezcas

---

## 7️⃣ CRON JOBS: ¿SERVICIO INDEPENDIENTE O ACOPLADO?

### Respuesta: SERVICIO INDEPENDIENTE ✅

**NO hagas esto** (acoplado):

```typescript
// ❌ MAL - Acoplado a Email
@Injectable()
export class EmailCronService {
  @Cron('0 8 ? * TUE')
  async sendMonthlyReport() { ... }
}
```

**Haz esto** (independiente):

```typescript
// ✅ BIEN - Servicio genérico
@Injectable()
export class CronService {
  constructor(
    private emailService: EmailService,
    private shipmentsService: ShipmentsService,
    // ... otros servicios
  ) {}

  @Cron('0 8 ? * TUE')
  async monthlyReport() {
    // Lógica genérica
    const data = await this.generateReportData();
    await this.emailService.sendImmediate(...);
  }

  @Cron('0 */6 * * *')
  async checkMissingDataShipments() {
    // Cambiar estados, enviar emails, etc
    const shipments = await this.shipmentsService.find(...);
    for (const shipment of shipments) {
      await this.shipmentsService.updateStatus(shipment.id, 'overdue');
      await this.emailService.sendImmediate(...);
    }
  }

  @Cron('0 0 * * 0')
  async cleanupOldData() {
    // Limpiar datos antiguos
    await this.shipmentsService.deleteOld();
  }
}
```

### Ventajas de Servicio Independiente

- ✅ **Reutilizable**: Úsalo para emails, cambios de estado, limpiezas, etc
- ✅ **Flexible**: Agrega nuevas tareas sin modificar Email
- ✅ **Testeable**: Fácil de mockear
- ✅ **Escalable**: Puedes mover a servicio separado después
- ✅ **Mantenible**: Lógica centralizada

### Estructura Recomendada

```
src/
├── cron/
│   ├── cron.module.ts
│   ├── cron.service.ts          # Servicio genérico
│   └── cron.tasks/
│       ├── monthly-report.task.ts
│       ├── missing-data-check.task.ts
│       └── cleanup.task.ts
├── email/
│   ├── email.module.ts
│   ├── email.service.ts
│   └── templates/
└── shipments/
    ├── shipments.module.ts
    └── shipments.service.ts
```

---

**¿Necesitas ayuda con alguno de estos puntos?**
