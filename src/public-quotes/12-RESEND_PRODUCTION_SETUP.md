# 📧 Resend - Configuración en Producción con Google Domains

## ℹ️ Estado Actual

✅ Ya tienes Resend configurado en tu proyecto:

- **EmailService**: `src/email/email.service.ts`
- **EmailConfig**: `src/email/email.config.ts`
- **Módulo**: `src/email/email.module.ts`

---

## 🎯 Paso a Paso para Producción

### PASO 1: Acceder a Resend Dashboard

1. Ir a https://resend.com/dashboard
2. Loguear con tu cuenta
3. Ir a **"Domains"** en el menú izquierdo

---

### PASO 2: Agregar Dominio en Resend

1. Click en **"Add Domain"**
2. Ingresar: `firstplug.com`
3. Resend te mostrará **3 registros DNS**:
   - **MX Record**
   - **SPF Record**
   - **DKIM Record**

**⚠️ COPIAR TODOS LOS VALORES** (los necesitarás en Google Domains)

---

### PASO 3: Acceder a Google Domains

1. Ir a https://domains.squarespace.com/es/google-domains
2. Loguear con tu cuenta Google
3. Seleccionar dominio: `firstplug.com`
4. Click en **"DNS"** en el menú izquierdo

---

### PASO 4: Agregar Registros DNS en Google Domains

#### 4.1 - MX Record

1. Click **"Crear registro personalizado"**
2. Llenar:
   - **Nombre**: `@`
   - **Tipo**: `MX`
   - **Datos**: Pegar valor MX de Resend
   - **Prioridad**: `10` (típicamente)
3. Click **"Guardar"**

#### 4.2 - SPF Record

1. Click **"Crear registro personalizado"**
2. Llenar:
   - **Nombre**: `@`
   - **Tipo**: `TXT`
   - **Datos**: Pegar SPF de Resend (ej: `v=spf1 include:resend.com ~all`)
3. Click **"Guardar"**

#### 4.3 - DKIM Record

1. Click **"Crear registro personalizado"**
2. Llenar:
   - **Nombre**: Resend te dirá (ej: `default._domainkey`)
   - **Tipo**: `TXT`
   - **Datos**: Pegar DKIM de Resend (valor largo)
3. Click **"Guardar"**

---

### PASO 5: Verificar Dominio en Resend

1. Volver a **Resend Dashboard** → **Domains**
2. Click en tu dominio
3. Click **"Verify Domain"**
4. Esperar 5-15 minutos

**Status debe cambiar a ✅ Verified**

---

### PASO 6: Actualizar Variables de Entorno

Tu configuración actual ya está lista. Solo necesitas:

```env
# .env.production
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
```

---

### PASO 7: Verificar Configuración en Código

Tu `EmailConfigService` ya valida todo:

```typescript
// src/email/email.config.ts
const EmailConfigSchema = z.object({
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().email().default('onboarding@resend.dev'),
  EMAIL_FROM_NAME: z.string().default('FirstPlug'),
});
```

---

## 🧪 Test en Producción

```typescript
// Usar tu EmailService existente
await this.emailService.sendImmediate('test@example.com', {
  recipientName: 'Test User',
  recipientEmail: 'test@example.com',
  tenantName: 'FirstPlug',
  type: EmailNotificationType.USER_ENABLED,
  title: 'Test Email',
  description: 'This is a test email from production',
});
```

---

## ⚠️ Problemas Comunes

### "Domain not verifying"

- Esperar 15-30 minutos
- Verificar registros DNS: https://mxtoolbox.com/
- Asegurar que los valores sean exactos

### "403 Error - Domain Mismatch"

- Verificar que `EMAIL_FROM` sea `noreply@firstplug.com`
- No usar otro dominio

### "Emails en spam"

- Agregar DMARC record (opcional pero recomendado)
- Calentar dominio (warm-up)
- Verificar SPF/DKIM correctamente

---

## ✅ Checklist Final

- [ ] Dominio agregado en Resend
- [ ] MX Record en Google Domains
- [ ] SPF Record en Google Domains
- [ ] DKIM Record en Google Domains
- [ ] Dominio verificado en Resend (✅ Verified)
- [ ] RESEND_API_KEY en .env.production
- [ ] EMAIL_FROM configurado
- [ ] Test email enviado exitosamente
