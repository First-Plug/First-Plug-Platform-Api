# 📧 Resend - Quick Reference

## Tu Configuración Actual ✅

```
EmailService: src/email/email.service.ts
EmailConfig:  src/email/email.config.ts
EmailModule:  src/email/email.module.ts
```

---

## 7 Pasos para Producción

### 1️⃣ Resend Dashboard
```
https://resend.com/dashboard → Domains → Add Domain
```

### 2️⃣ Agregar Dominio
```
Dominio: firstplug.com
Copiar: MX, SPF, DKIM records
```

### 3️⃣ Google Domains
```
https://domains.squarespace.com/es/google-domains
Seleccionar: firstplug.com
Ir a: DNS
```

### 4️⃣ Agregar Registros DNS
```
MX Record:   @ → MX → [valor Resend]
SPF Record:  @ → TXT → v=spf1 include:resend.com ~all
DKIM Record: default._domainkey → TXT → [valor Resend]
```

### 5️⃣ Verificar Dominio
```
Resend Dashboard → Verify Domain
Esperar: 5-15 minutos
Status: ✅ Verified
```

### 6️⃣ Variables de Entorno
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
```

### 7️⃣ Test Email
```typescript
await this.emailService.sendImmediate('test@example.com', {
  recipientName: 'Test',
  recipientEmail: 'test@example.com',
  tenantName: 'FirstPlug',
  type: EmailNotificationType.USER_ENABLED,
  title: 'Test',
  description: 'Test email',
});
```

---

## Herramientas Útiles

| Herramienta | URL |
|---|---|
| Verificar DNS | https://mxtoolbox.com/ |
| Resend Dashboard | https://resend.com/dashboard |
| Google Domains | https://domains.squarespace.com/es/google-domains |

---

## Problemas Comunes

| Problema | Solución |
|---|---|
| Domain not verifying | Esperar 15-30 min, verificar DNS exactos |
| 403 Domain Mismatch | EMAIL_FROM debe ser noreply@firstplug.com |
| Emails en spam | Agregar DMARC, calentar dominio |

---

## Documentación Completa

Ver: `12-RESEND_PRODUCTION_SETUP.md`

