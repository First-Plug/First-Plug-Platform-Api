# 💻 [8/10] Ejemplos de Código - Email Service

## 1️⃣ EmailService Core

```typescript
// src/email/email.service.ts
@Injectable()
export class EmailService {
  constructor(
    private resend: Resend,
    @InjectQueue('email') private emailQueue: Queue,
    private logger: Logger,
  ) {}

  // Envío inmediato
  async sendImmediate(
    to: string,
    templateName: string,
    data: any,
  ): Promise<void> {
    const template = this.getTemplate(templateName);
    const html = template.render(data);

    try {
      const result = await this.resend.emails.send({
        from: 'noreply@firstplug.com',
        to,
        subject: template.subject(data),
        html,
      });

      await this.logEmail(to, templateName, 'sent', result.id);
    } catch (error) {
      this.logger.error(`Email failed: ${error.message}`);
      throw error;
    }
  }

  // Envío delayed
  async sendDelayed(
    to: string,
    templateName: string,
    data: any,
    delayMs: number,
  ): Promise<void> {
    await this.emailQueue.add(
      { to, templateName, data },
      { delay: delayMs, attempts: 3 },
    );
  }

  private getTemplate(name: string) {
    // Retorna template compilado
  }

  private async logEmail(to, template, status, resendId) {
    // Registra en BD para auditoría
  }
}
```

---

## 2️⃣ Template Ejemplo

```typescript
// src/email/templates/shipment-created.template.ts
export class ShipmentCreatedTemplate {
  subject(data: { shipment: any }): string {
    return `Shipment #${data.shipment.id} created`;
  }

  html(data: {
    shipment: any;
    user: any;
    status: 'in_preparation' | 'missing_data';
  }): string {
    if (data.status === 'missing_data') {
      return this.missingDataTemplate(data);
    }
    return this.successTemplate(data);
  }

  private successTemplate(data): string {
    return `
      <h1>Shipment Created</h1>
      <p>Your shipment #${data.shipment.id} was created successfully.</p>
      <p>We're working on it...</p>
    `;
  }

  private missingDataTemplate(data): string {
    return `
      <h1>ACTION REQUIRED: Update Shipment Data</h1>
      <p>Your shipment is missing required data.</p>
      <a href="https://firstplug.com/video/missing-data">
        Watch tutorial
      </a>
    `;
  }
}
```

---

## 3️⃣ Queue Processor

```typescript
// src/email/queue/email.processor.ts
@Processor('email')
export class EmailProcessor {
  constructor(private emailService: EmailService) {}

  @Process()
  async processEmail(job: Job<EmailJob>) {
    const { to, templateName, data } = job.data;

    try {
      await this.emailService.sendImmediate(to, templateName, data);
    } catch (error) {
      // Reintentos automáticos por Bull
      throw error;
    }
  }
}
```

---

## 4️⃣ Cron Job

```typescript
// src/email/cron/monthly-report.cron.ts
@Injectable()
export class MonthlyReportCron {
  @Cron('0 8 ? * TUE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async sendMonthlyReport() {
    const tenants = await this.tenantsService.findAll();

    for (const tenant of tenants) {
      const data = await this.generateReportData(tenant);

      await this.emailService.sendImmediate(
        tenant.adminEmail,
        'monthly-report',
        data,
      );
    }
  }

  private async generateReportData(tenant) {
    // Lógica compleja de generación de datos
    return {
      tenant,
      computers: [...],
      stats: {...},
    };
  }
}
```

---

## 5️⃣ Integración en Servicio (Event-Driven)

```typescript
// src/shipments/shipments.service.ts
@Injectable()
export class ShipmentsService {
  constructor(
    private eventEmitter: EventEmitter2,
    // ... otros servicios
  ) {}

  async createShipment(dto: CreateShipmentDto) {
    const shipment = await this.create(dto);

    // Emitir evento (desacoplado)
    this.eventEmitter.emit('shipment.created', {
      shipment,
      user: dto.user,
    });

    return shipment;
  }

  async updateShipmentStatus(id: string, newStatus: string) {
    const shipment = await this.shipmentsModel.findById(id);
    const oldStatus = shipment.status;

    shipment.status = newStatus;
    await shipment.save();

    // Emitir evento de cambio
    this.eventEmitter.emit('shipment.status-changed', {
      shipment,
      oldStatus,
      newStatus,
    });

    return shipment;
  }
}

// src/email/email.service.ts - Escuchar eventos
@Injectable()
export class EmailService {
  constructor(private eventEmitter: EventEmitter2) {}

  @OnEvent('shipment.created')
  async handleShipmentCreated(payload: any) {
    if (payload.shipment.status === 'in_preparation') {
      await this.sendImmediate(payload.user.email, 'shipment-created', payload);
    } else if (payload.shipment.status === 'missing_data') {
      await this.sendDelayed(
        payload.user.email,
        'shipment-created',
        payload,
        10 * 60 * 1000,
      );
    }
  }

  @OnEvent('shipment.status-changed')
  async handleStatusChanged(payload: any) {
    if (
      payload.newStatus === 'in_preparation' &&
      payload.oldStatus === 'missing_data'
    ) {
      await this.sendImmediate(
        payload.shipment.user.email,
        'shipment-completed',
        payload,
      );
    }
  }
}
```

---

## 6️⃣ Módulo Email

```typescript
// src/email/email.module.ts
@Module({
  imports: [BullModule.registerQueue({ name: 'email' })],
  providers: [
    EmailService,
    EmailProcessor,
    MonthlyReportCron,
    OnboardingCron,
    // Templates
    ShipmentCreatedTemplate,
    UserEnabledTemplate,
    // ...
  ],
  exports: [EmailService],
})
export class EmailModule {}
```

---

## 7️⃣ Configuración .env

```bash
# Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@firstplug.com

# Queue
REDIS_HOST=localhost
REDIS_PORT=6379

# Fallback
BREVO_API_KEY=xxxxxxxxxxxxx
```

---

## 8️⃣ Testing

```typescript
// src/email/email.service.spec.ts
describe('EmailService', () => {
  let service: EmailService;
  let resendMock: jest.Mock;

  beforeEach(() => {
    resendMock = jest.fn();
    service = new EmailService(resendMock, queueMock);
  });

  it('should send email immediately', async () => {
    await service.sendImmediate('user@example.com', 'user-enabled', {
      user: { name: 'John' },
    });

    expect(resendMock).toHaveBeenCalled();
  });

  it('should queue delayed email', async () => {
    await service.sendDelayed(
      'user@example.com',
      'shipment-created',
      { shipment: {} },
      10 * 60 * 1000,
    );

    expect(queueMock.add).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ delay: 600000 }),
    );
  });
});
```

---

## 📝 Notas

- Todos los ejemplos son pseudocódigo, adaptar a tu proyecto
- Usar Zod para validación de datos
- Implementar logging con Winston
- Agregar métricas con Prometheus
