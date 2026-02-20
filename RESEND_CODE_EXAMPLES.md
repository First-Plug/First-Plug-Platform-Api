# 💻 Ejemplos de Código Listos para Usar

## 1. Corregir Type Casting (5 minutos)

### Archivo: src/users/users.service.ts

**Cambiar línea 358 de:**
```typescript
type: 'USER_ENABLED' as any,
```

**A:**
```typescript
type: EmailNotificationType.USER_ENABLED,
```

**Asegúrate de importar:**
```typescript
import { EmailNotificationType } from '../email/email.types';
```

---

## 2. Crear UserEnabledEmailBuilder

### Archivo: src/email/builders/user-enabled.builder.ts

```typescript
import { EmailProps, EmailNotificationType } from '../email.types';

export class UserEnabledEmailBuilder {
  static build(
    firstName: string,
    email: string,
    tenantName: string,
    frontendUrl: string = 'http://localhost:3000'
  ): EmailProps {
    return {
      recipientName: firstName,
      recipientEmail: email,
      tenantName,
      type: EmailNotificationType.USER_ENABLED,
      title: 'Welcome to First Plug',
      description: `Your account has been activated. You can now access the First Plug platform with your credentials.`,
      buttonText: 'Go to Login',
      buttonUrl: `${frontendUrl}/login`,
    };
  }
}
```

---

## 3. Crear NotificationsService

### Archivo: src/notifications/notifications.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { UserEnabledEmailBuilder } from '../email/builders/user-enabled.builder';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private emailService: EmailService) {}

  async notifyUserEnabled(
    firstName: string,
    email: string,
    tenantName: string
  ) {
    try {
      const props = UserEnabledEmailBuilder.build(
        firstName,
        email,
        tenantName,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );
      
      const result = await this.emailService.sendImmediate(email, props);
      
      if (!result.success) {
        this.logger.warn(`Failed to send welcome email to ${email}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error notifying user enabled:`, error);
      throw error;
    }
  }
}
```

### Archivo: src/notifications/notifications.module.ts

```typescript
import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EmailModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

---

## 4. Actualizar users.service.ts

### Cambiar assignTenantSuperAdmin()

**De:**
```typescript
// Enviar email de bienvenida si se asignó un tenant (no es superadmin)
if (role !== 'superadmin' && tenantId) {
  try {
    await this.emailService.sendImmediate(updatedUser.email, {
      recipientName: updatedUser.firstName,
      recipientEmail: updatedUser.email,
      tenantName: tenantName || 'First Plug',
      type: 'USER_ENABLED' as any,
      title: 'Welcome to First Plug',
      description: `Your account has been activated...`,
      buttonText: 'Go to Login',
      buttonUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
    });
  } catch (error) {
    this.logger.error(`Error sending welcome email...`, error);
  }
}
```

**A:**
```typescript
// Enviar email de bienvenida si se asignó un tenant (no es superadmin)
if (role !== 'superadmin' && tenantId) {
  try {
    await this.notificationsService.notifyUserEnabled(
      updatedUser.firstName,
      updatedUser.email,
      tenantName || 'First Plug'
    );
  } catch (error) {
    this.logger.error(`Error sending welcome email to ${updatedUser.email}:`, error);
  }
}
```

**Agregar al constructor:**
```typescript
constructor(
  @InjectModel(User.name)
  private readonly userModel: Model<User>,
  @InjectSlack() private readonly slack: IncomingWebhook,
  private readonly eventsGateway: EventsGateway,
  private readonly emailService: EmailService,
  private readonly notificationsService: NotificationsService,  // ← AGREGAR
) {}
```

---

## 5. Actualizar super-admin.service.ts

### Cambiar assignTenantToUser()

**Agregar al constructor:**
```typescript
constructor(
  @InjectModel(User.name) private userModel: Model<UserDocument>,
  @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  private tenantConnectionService: TenantConnectionService,
  private tenantModelRegistry: TenantModelRegistry,
  private usersService: UsersService,  // ← AGREGAR
  private notificationsService: NotificationsService,  // ← AGREGAR
) {}
```

**Cambiar el método:**
```typescript
async assignTenantToUser(
  userId: string,
  tenantId: string,
): Promise<UserDocument> {
  try {
    // Validaciones...
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException(`ID de usuario inválido: ${userId}`);
    }
    if (!Types.ObjectId.isValid(tenantId)) {
      throw new NotFoundException(`ID de tenant inválido: ${tenantId}`);
    }

    const tenant = await this.tenantModel.findOne({
      _id: tenantId,
      isActive: true,
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado`);
    }

    const user = await this.userModel.findOne({
      _id: userId,
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    if (user.tenantId) {
      throw new Error(`Usuario ${user.email} ya tiene un tenant asignado`);
    }

    // Asignar tenant
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        tenantId: new Types.ObjectId(tenantId),
        status: 'active',
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new Error('Error actualizando usuario');
    }

    // ← AGREGAR: Enviar notificación
    try {
      await this.notificationsService.notifyUserEnabled(
        updatedUser.firstName || 'User',
        updatedUser.email,
        tenant.tenantName
      );
    } catch (error) {
      this.logger.warn(`Could not send welcome email:`, error.message);
    }

    return updatedUser;
  } catch (error) {
    this.logger.error(`Error asignando tenant a usuario:`, error.message);
    throw error;
  }
}
```

---

## 6. Actualizar app.module.ts

**Agregar NotificationsModule:**
```typescript
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // ... otros imports
    EmailModule,
    NotificationsModule,  // ← AGREGAR
  ],
})
export class AppModule {}
```

---

## 📋 Checklist de Implementación

- [ ] Crear archivo user-enabled.builder.ts
- [ ] Crear archivo notifications.service.ts
- [ ] Crear archivo notifications.module.ts
- [ ] Actualizar users.service.ts
- [ ] Actualizar super-admin.service.ts
- [ ] Actualizar app.module.ts
- [ ] Importar NotificationsService en super-admin.module.ts
- [ ] Probar que los emails se envíen correctamente

