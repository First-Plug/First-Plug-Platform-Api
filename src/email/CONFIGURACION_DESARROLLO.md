# 🔧 Configuración para Desarrollo

## Modo Desarrollo (Sin RESEND_API_KEY)

En desarrollo, el módulo funciona sin `RESEND_API_KEY`:

```env
# No incluir RESEND_API_KEY o dejar vacío
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=test@example.com
```

**Comportamiento:**

- Los emails NO se enviarán
- Se registrará un warning en los logs
- Retornará error: "RESEND_API_KEY no configurado"
- Útil para testing sin enviar emails reales

**Nota:** Si incluyes `RESEND_API_KEY=` vacío, también funcionará.

## Modo Staging/Producción (Con RESEND_API_KEY)

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=test@example.com  # Opcional
```

**Comportamiento:**

- Los emails se enviarán a través de Resend
- Se registrará el messageId en los logs
- Retornará success: true con messageId

## Obtener RESEND_API_KEY

1. Ir a https://resend.com
2. Crear cuenta
3. Ir a Settings → API Keys
4. Copiar la API key
5. Agregar a `.env`

## Modo de Prueba (EMAIL_TEST_RECIPIENT)

Si configuras `EMAIL_TEST_RECIPIENT`, todos los emails se enviarán también a ese email:

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@firstplug.com
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=tu-email@example.com
```

Cada email enviado a un usuario también se enviará a `tu-email@example.com` con el prefijo `[TEST]` en el asunto.

## Verificación

Para verificar que está configurado correctamente:

```bash
# Ver logs al iniciar la aplicación
npm run start:dev

# Buscar mensajes de email en los logs
# Si RESEND_API_KEY no está configurado:
# [Nest] ... WARN [EmailService] RESEND_API_KEY no configurado...

# Si está configurado correctamente:
# [Nest] ... LOG [EmailService] Email sent successfully to...
```
