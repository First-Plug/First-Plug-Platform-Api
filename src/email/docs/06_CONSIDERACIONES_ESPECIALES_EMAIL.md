# ⚠️ [6/10] Consideraciones Especiales - Email Service

## 🚨 Decisiones Críticas

### 1. **Resend vs Alternativas**

**¿Por qué Resend y no Brevo?**

- Resend: API moderna, mejor para developers, escalable
- Brevo: Más features pero interfaz compleja, overkill inicial

**Decisión**: Resend como principal, Brevo como fallback

---

### 2. **Queue System: Bull vs RabbitMQ**

**Recomendación**: Bull (Redis-based)

- ✅ Más simple para NestJS
- ✅ Menos infraestructura
- ✅ Suficiente para volumen actual
- ⚠️ Escalar a RabbitMQ si > 100k emails/mes

---

### 3. **Delayed Emails: 10 Minutos**

**¿Por qué 10 minutos para shipment created?**

- Permite que el shipment se estabilice en BD
- Evita enviar emails de shipments incompletos
- Mejora UX: usuario ve confirmación en UI primero

**Implementación**:

```typescript
// En queue processor
await this.emailService.sendDelayed(
  email,
  template,
  data,
  10 * 60 * 1000, // 10 minutos
);
```

---

### 4. **Cron Service: Independiente y Reutilizable**

⚠️ **IMPORTANTE**: Cron es un servicio SEPARADO, NO acoplado a Email

**Problema**: Acoplar cron jobs a Email limita reutilización

**Solución**: Crear CronService independiente

```typescript
// ✅ BIEN - Servicio genérico
@Injectable()
export class CronService {
  constructor(
    private emailService: EmailService,
    private shipmentsService: ShipmentsService,
    // ... otros servicios
  ) {}

  @Cron('0 8 ? * TUE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async monthlyReport() {
    // Puede enviar emails, cambiar estados, etc
  }

  @Cron('0 */6 * * *')
  async checkMissingDataShipments() {
    // Verificar shipments y enviar recordatorios
  }
}
```

**Ventajas**:

- ✅ Reutilizable para otros fines
- ✅ Flexible (emails, cambios de estado, limpiezas)
- ✅ Fácil de testear
- ✅ Escalable

---

### 5. **Multi-Tenant Emails**

**Consideración**: Cada tenant puede tener:

- Branding personalizado
- Idioma diferente
- Horarios diferentes

**Implementación**:

```typescript
// Pasar tenantId a template
const template = this.getTemplate('shipment-created', tenant.id);
```

---

### 6. **Tracking y Logging**

**Registrar**:

- ✅ Email enviado (timestamp, destinatario)
- ✅ Template usado
- ✅ Status de entrega (Resend webhook)
- ✅ Errores y reintentos
- ✅ Bounces y unsubscribes

**Tabla de auditoría**:

```typescript
interface EmailLog {
  id: ObjectId;
  tenantId: ObjectId;
  to: string;
  template: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  resendId: string;
  createdAt: Date;
  deliveredAt?: Date;
  error?: string;
}
```

---

### 7. **Validación de Emails**

**Antes de enviar**:

```typescript
// Validar formato
const emailSchema = z.string().email();

// Validar que usuario existe
const user = await this.usersService.findByEmail(to);
if (!user) throw new BadRequestException('User not found');

// Validar que no está unsubscribed
if (user.emailUnsubscribed) return;
```

---

### 8. **Manejo de Errores**

**Estrategia**:

1. **Reintentos automáticos** (Bull): 3 intentos
2. **Fallback a Brevo** si Resend falla
3. **Alertas** si > 5% de fallos
4. **Logging** de todos los errores

---

### 9. **Testing**

**Usar Resend Sandbox**:

```typescript
// En tests
const resendClient = new Resend(process.env.RESEND_API_KEY_SANDBOX);
```

**Emails de prueba**:

- `delivered@resend.dev` → Siempre entregado
- `bounce@resend.dev` → Simula bounce
- `complaint@resend.dev` → Simula complaint

---

### 10. **Seguridad**

**Protecciones**:

- ✅ API key en `.env`, NUNCA en código
- ✅ Validar destinatarios antes de enviar
- ✅ Rate limiting: máx 100 emails/min por usuario
- ✅ Logging de acceso a EmailService
- ✅ Encriptar datos sensibles en logs

---

### 11. **Performance**

**Optimizaciones**:

- ✅ Batch emails cuando sea posible
- ✅ Cache de templates compilados
- ✅ Async/await para no bloquear
- ✅ Índices en tabla de logs

---

### 12. **Compliance**

**Consideraciones legales**:

- ✅ Incluir unsubscribe link en todos los emails
- ✅ Respetar GDPR (datos personales)
- ✅ Mantener logs de consentimiento
- ✅ Política de privacidad en footer

---

## 📋 Checklist Pre-Implementación

- [ ] Crear cuenta Resend
- [ ] Obtener API key
- [ ] Configurar dominio (si es necesario)
- [ ] Crear tabla EmailLog en BD
- [ ] Diseñar templates HTML
- [ ] Configurar Bull/Redis
- [ ] Crear tests
- [ ] Documentar API de EmailService
- [ ] Entrenar equipo en uso
