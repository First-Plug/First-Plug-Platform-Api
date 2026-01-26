# 🧪 Prueba de Integración - Email en Auth Module

## Objetivo

Probar el envío de email cuando un SuperAdmin asigna un tenant a un usuario.

## Arquitectura

El email se envía en **UsersService.assignTenant()**, no en el controlador:

- ✅ Lógica de negocio centralizada
- ✅ Reutilizable desde cualquier lugar
- ✅ Fácil de testear
- ✅ Respeta Single Responsibility Principle

## Flujo

1. **Usuario se registra** → Sin tenant asignado
2. **SuperAdmin asigna tenant** → Llama a `usersService.assignTenant()`
3. **UsersService** → Asigna tenant + Envía email automáticamente
4. **Usuario recibe email** → Con botón para ir a login

## Pasos para Probar

### 1. Configurar Variables de Entorno

```env
# .env
RESEND_API_KEY=re_XchxSwAj_P9nZed6eY4H454d1GYPDUdYQ
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=firstplugtesting@gmail.com
FRONTEND_URL=http://localhost:3000
```

### 2. Iniciar Servidor

```bash
npm run start:dev
```

### 3. Crear Usuario (POST /auth/register)

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Respuesta esperada:**

```json
{
  "_id": "...",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": null,
  "message": "Usuario creado. Debe ser asignado a un tenant para poder hacer login."
}
```

### 4. Crear Tenant (POST /auth/create-tenant)

Requiere: `JwtGuard` + `SuperAdminGuard`

```json
{
  "name": "Acme Corp",
  "tenantName": "acme-corp"
}
```

### 5. Asignar Tenant a Usuario (POST /auth/assign-tenant-to-user)

Requiere: `JwtGuard` + `SuperAdminGuard`

```json
{
  "userEmail": "john@example.com",
  "tenantName": "acme-corp"
}
```

**Aquí se envía el email** ✉️

### 6. Verificar Email

Revisa `firstplugtesting@gmail.com` (EMAIL_TEST_RECIPIENT)

**Email esperado:**

- **Asunto:** Welcome to FirstPlug
- **Contenido:** Account activated message
- **Botón:** "Go to Login" → http://localhost:3000/login

## Email Template

El email usa el template único que se adapta a todos los tipos:

```typescript
{
  recipientName: "John",
  recipientEmail: "john@example.com",
  tenantName: "Acme Corp",
  type: "USER_ENABLED",
  title: "Welcome to FirstPlug",
  description: "Your account has been activated. You can now access the FirstPlug platform with your credentials.",
  buttonText: "Go to Login",
  buttonUrl: "http://localhost:3000/login"
}
```

## Logs Esperados

```
[Nest] ... LOG [EmailService] Email sent successfully to john@example.com (messageId: msg-xxx)
```

## Troubleshooting

- **"RESEND_API_KEY no configurado"** → Agregar API key al .env y reiniciar
- **Email no llega** → Revisar EMAIL_TEST_RECIPIENT en .env
- **Error de validación** → Verificar que userEmail y tenantName sean válidos
