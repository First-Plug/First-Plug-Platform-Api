# 🚀 Quick Start - Email Module

## 1. Configuración

### Desarrollo (Sin API Key)

```env
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
```

### Staging/Producción (Con API Key)

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=test@example.com  # Opcional
```

Ver `CONFIGURACION_DESARROLLO.md` para más detalles.

## 2. Inyectar en tu Servicio

```typescript
import { EmailService } from './email/email.service';
import { EmailNotificationType } from './email/email.types';

@Injectable()
export class MyService {
  constructor(private emailService: EmailService) {}
}
```

## 3. Enviar Email

```typescript
await this.emailService.sendImmediate('user@example.com', {
  recipientName: 'John Doe',
  recipientEmail: 'user@example.com',
  tenantName: 'FirstPlug',
  type: EmailNotificationType.USER_ENABLED,
  title: '¡Bienvenido!',
  description: 'Tu cuenta ha sido habilitada',
  buttonText: 'Ir a FirstPlug',
  buttonUrl: 'https://app.firstplug.com',
});
```

## 4. Tipos Disponibles

```typescript
EmailNotificationType.USER_ENABLED;
EmailNotificationType.SHIPMENT_CREATED;
EmailNotificationType.SHIPMENT_ON_WAY;
EmailNotificationType.SHIPMENT_RECEIVED;
EmailNotificationType.SHIPMENT_CANCELLED;
EmailNotificationType.QUOTE_CREATED;
EmailNotificationType.QUOTE_CANCELLED;
EmailNotificationType.OFFBOARDING;
```

## 5. Respuesta

```typescript
{
  success: boolean;
  messageId?: string;  // Si fue exitoso
  error?: string;      // Si falló
  timestamp: Date;
}
```

## 📚 Documentación Completa

Ver `src/email/docs/` para documentación detallada.
