# 🏗️ [3/5] Arquitectura del Email Service - FirstPlug

## 🎯 Principios de Diseño

1. **Encapsulación Total**: Email service completamente independiente
2. **Reutilizable**: Usado por múltiples servicios sin acoplamiento
3. **Escalable**: Soporta transaccionales, delayed y cron jobs
4. **Mantenible**: Lógica centralizada, fácil de modificar
5. **Testeable**: Inyección de dependencias, mocks simples

---

## 📁 Estructura de Carpetas

```
src/
├── email/                              # Email Service (Encapsulado)
│   ├── email.module.ts                 # Módulo principal
│   ├── email.service.ts                # Servicio core
│   ├── email.config.ts                 # Configuración (Resend API key)
│   ├── templates/
│   │   ├── user-enabled.template.ts    # Template: Usuario habilitado
│   │   ├── shipment-created.template.ts
│   │   ├── shipment-on-way.template.ts
│   │   ├── quote-created.template.ts
│   │   ├── onboarding-reminder.template.ts
│   │   ├── monthly-report.template.ts
│   │   └── base.template.ts            # Template base
│   ├── types/
│   │   ├── email.types.ts              # Tipos e interfaces
│   │   └── templates.types.ts
│   ├── queue/
│   │   ├── email.queue.ts              # Bull queue para delayed
│   │   └── email.processor.ts          # Procesador de queue
│   └── events/
│       └── email.events.ts             # Event listeners (@OnEvent)
│
├── cron/                               # Cron Service (Independiente)
│   ├── cron.module.ts                  # Módulo principal
│   ├── cron.service.ts                 # Servicio genérico
│   └── tasks/
│       ├── monthly-report.task.ts      # Tarea: Monthly report
│       ├── missing-data-check.task.ts  # Tarea: Verificar shipments
│       └── cleanup.task.ts             # Tarea: Limpiar datos
```

**Nota**: Cron está SEPARADO de Email. Puede usarse para:

- Enviar emails
- Cambiar estados
- Limpiar datos
- Sincronizar información
- Cualquier otra tarea periódica

---

## 🔧 Componentes Principales

### 1. **EmailService** (Core)

```typescript
@Injectable()
export class EmailService {
  // Métodos públicos reutilizables
  async sendImmediate(to, template, data);
  async sendDelayed(to, template, data, delayMs);
  async sendBatch(recipients, template, data);

  // Métodos privados
  private renderTemplate(template, data);
  private validateEmail(email);
  private logEmail(email, status);
}
```

### 2. **Templates** (Dinámicos)

```typescript
// Cada template es una clase con:
- subject(data): string
- html(data): string
- text(data): string
- validate(data): boolean
```

### 3. **Queue System** (Bull)

```typescript
// Para delayed emails (10 min, recordatorios, etc)
- Procesa emails en background
- Reintentos automáticos
- Logging de fallos
```

### 4. **Cron Jobs Service** (NestJS Schedule - INDEPENDIENTE)

⚠️ **IMPORTANTE**: Los Cron Jobs son un servicio SEPARADO, NO acoplado a Email

```typescript
// src/cron/cron.module.ts
// Servicio genérico para tareas programadas
// Puede usarse para:
// - Enviar emails (onboarding, monthly report)
// - Cambiar estados (shipments, quotes)
// - Limpiar datos
// - Sincronizar información
// - Cualquier otra tarea periódica

@Injectable()
export class CronService {
  @Cron('0 8 ? * TUE') // Primer martes 10:08
  async monthlyReport() {
    // Lógica genérica
  }

  @Cron('0 9 * * *') // Cada día 9:00
  async checkMissingDataShipments() {
    // Lógica genérica
  }
}
```

**Ventajas de separar**:

- ✅ Reutilizable para otros fines
- ✅ Fácil de testear
- ✅ No acoplado a Email
- ✅ Escalable

---

## 🔌 Integración con Servicios Existentes

### Patrón 1: Event-Driven (Recomendado)

```typescript
// En ShipmentsService - Emitir evento
async createShipment(dto) {
  const shipment = await this.create(dto);

  // Emitir evento (no acoplado a Email)
  this.eventEmitter.emit('shipment.created', {
    shipment,
    user: dto.user,
  });
}

// En EmailService - Escuchar evento
@OnEvent('shipment.created')
async handleShipmentCreated(payload: any) {
  if (payload.shipment.status === 'in_preparation') {
    // Email inmediato
    await this.sendImmediate(
      payload.user.email,
      'shipment-created',
      payload
    );
  } else if (payload.shipment.status === 'missing_data') {
    // Email delayed (10 min)
    await this.sendDelayed(
      payload.user.email,
      'shipment-created',
      payload,
      10 * 60 * 1000
    );
  }
}

// En ShipmentsService - Escuchar cambio de estado
@OnEvent('shipment.status-changed')
async handleStatusChanged(payload: any) {
  if (payload.newStatus === 'in_preparation' &&
      payload.oldStatus === 'missing_data') {
    // Email de confirmación
    await this.emailService.sendImmediate(
      payload.user.email,
      'shipment-completed',
      payload
    );
  }
}
```

**Ventajas**:

- ✅ Desacoplado
- ✅ Flexible
- ✅ Fácil de testear
- ✅ Escalable

### Patrón 2: Delayed Fallback (Recordatorio)

```typescript
// En CronService - Verificar cada X horas
@Cron('0 */6 * * *') // Cada 6 horas
async checkMissingDataShipments() {
  const shipments = await this.shipmentsService.find({
    status: 'missing_data',
    createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) }
  });

  for (const shipment of shipments) {
    await this.emailService.sendImmediate(
      shipment.user.email,
      'shipment-missing-data-reminder',
      { shipment }
    );
  }
}
```

### Patrón 3: Cron Job (Tareas Programadas)

```typescript
// En CronService
@Cron('0 8 ? * TUE') // Primer martes 10:08
async sendMonthlyReport() {
  const tenants = await this.tenantsService.findAll();

  for (const tenant of tenants) {
    const data = await this.generateReportData(tenant);
    await this.emailService.sendImmediate(
      tenant.adminEmail,
      'monthly-report',
      data
    );
  }
}
```

---

## 📊 Flujo de Datos

```
Evento en Servicio
    ↓
EmailService.sendImmediate/Delayed
    ↓
Template Rendering
    ↓
Validación
    ↓
Queue (si delayed) / Resend API (si inmediato)
    ↓
Logging + Tracking
    ↓
Webhook (delivery status)
```

---

## ✅ Ventajas de esta Arquitectura

1. **Separación de Responsabilidades**: Email logic aislada
2. **Reutilizable**: Cualquier servicio puede enviar emails
3. **Testeable**: Fácil mockear EmailService
4. **Escalable**: Soporta múltiples tipos de notificaciones
5. **Mantenible**: Cambios en templates no afectan servicios
6. **Flexible**: Fácil agregar nuevas notificaciones
