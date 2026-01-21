# 🎯 Public Quotes - Decisiones Clave

## 1. ✅ Módulo Aislado (PublicQuotesModule)

### Decisión

Crear módulo separado de `QuotesModule` en lugar de reutilizar.

### Razones

- **Flujos diferentes**: BD vs no-BD
- **Seguridad diferente**: JWT vs Rate Limiting
- **Datos diferentes**: Estructura completamente diferente
- **Numeración diferente**: QR vs PQR
- **Escalabilidad**: Cambios futuros sin afectar quotes logueadas
- **Claridad**: Código más limpio y mantenible

### Alternativa Rechazada

Reutilizar `QuotesModule` con flags condicionales:

- ❌ Acoplamiento innecesario
- ❌ Lógica condicional compleja
- ❌ Difícil de mantener
- ❌ Riesgo de bugs

---

## 2. ✅ Sin Persistencia en BD

### Decisión

Datos NO se guardan en base de datos en este release inicial.

### Razones

- **Simplifica arquitectura**: No requiere tenant, colecciones, etc.
- **Release inicial**: Funcionalidad mínima viable
- **Datos temporales**: Quotes públicas son "one-time"
- **Slack es suficiente**: FirstPlug recibe notificación

### Futuro

En próximos releases se puede agregar persistencia:

- Crear colección global `public_quotes`
- Agregar búsqueda/filtrado
- Agregar seguimiento de conversión

---

## 3. ✅ Numeración PQR (Sin BD)

### Decisión

Formato: `PQR-{timestamp}-{random}`

Ejemplo: `PQR-1705123456789-A7K2`

### Razones

- ✅ Único sin BD
- ✅ Timestamp para ordenamiento
- ✅ Random para evitar predicción
- ✅ Corto y legible
- ✅ No requiere transacciones

### Alternativas Rechazadas

- ❌ UUID: Muy largo
- ❌ Secuencial: Requiere BD
- ❌ Solo timestamp: Puede haber colisiones

---

## 4. ✅ Datos Requeridos

### Decisión

```
✅ Email (validado, no @firstplug.com)
✅ Nombre y Apellido
✅ Nombre de Empresa
✅ País (código ISO)
❌ Teléfono (opcional)
✅ Tipo de Solicitud: 'product' | 'service' | 'mixed'
✅ Productos (si aplica)
✅ Servicios (si aplica, EXCEPTO Offboarding)
```

### Productos Disponibles

Computer, Monitor, Audio, Peripherals, Merchandising, Phone, Furniture, Tablet, Other

### Servicios Disponibles

IT Support, Enrollment, Data Wipe, Destruction and Recycling, Buyback, Donate, Cleaning, Storage

**NOTA**: Offboarding NO está disponible (solo usuarios logueados)

### Razones

- **Email**: Para contactar al cliente (validado, no @firstplug.com)
- **Nombre**: Identificación personal
- **Empresa**: Contexto del pedido
- **País**: Ubicación geográfica (código ISO)
- **Teléfono**: Opcional, mejor contacto
- **requestType**: Distinguir entre producto, servicio o ambos
- **Productos/Servicios**: Mismo esquema que quotes logueadas
- **Sin Offboarding**: Requiere datos internos de tenant (solo logueados)

---

## 5. ✅ Rate Limiting (10 req/min)

### Decisión

Máximo 10 requests por minuto por IP.

### Razones

- **Previene abuso**: Spam, bots
- **Protege Slack**: No saturar canal
- **Razonable**: 10 quotes/min es mucho para un cliente
- **Por IP**: Identifica origen del ataque

### Implementación

```typescript
@Throttle({ default: { limit: 10, ttl: 60000 } })
```

---

## 6. ✅ Validación Zod

### Decisión

Usar Zod para validación de datos.

### Razones

- **Consistencia**: Mismo patrón que quotes logueadas
- **Type-safe**: Generación automática de DTOs
- **Flexible**: Validaciones condicionales
- **Errores claros**: Mensajes descriptivos

### Validaciones

- Email: Formato válido, no @firstplug.com
- Nombre: 2-100 chars, trim
- Empresa: 2-100 chars, trim
- País: Código ISO o nombre
- Teléfono: Formato internacional (opcional)

---

## 7. ✅ Reutilización de SlackService

### Decisión

Usar `SlackService.sendQuoteMessage()` existente.

### Razones

- **No duplicar código**: Ya existe
- **Consistencia**: Mismo formato que quotes logueadas
- **Mantenibilidad**: Cambios centralizados
- **Webhook configurado**: `SLACK_WEBHOOK_URL_QUOTES`

### Implementación

```typescript
await this.slackService.sendQuoteMessage(payload);
```

---

## 8. ✅ Sin Autenticación

### Decisión

Endpoints públicos sin JWT Guard.

### Razones

- **Acceso público**: Clientes potenciales sin cuenta
- **Simplifica flujo**: No requiere login
- **Seguridad por Rate Limiting**: Protección alternativa
- **Datos no sensibles**: Solo información de contacto

### Protecciones

- ✅ Rate limiting
- ✅ Validación Zod
- ✅ Sanitización
- ✅ CORS

---

## 9. ✅ Arquitectura de Servicios

### Decisión

```
Controller → Coordinador → Servicio Raíz + SlackService
```

### Razones

- **Separación de responsabilidades**: Cada capa tiene rol claro
- **Reutilización**: SlackService es independiente
- **Testabilidad**: Fácil de mockear
- **Escalabilidad**: Agregar lógica sin afectar otras capas

### Capas

- **Controller**: Recibe requests, valida, delega
- **Coordinador**: Orquesta flujo, maneja errores
- **Servicio Raíz**: Lógica core (generar PQR, preparar payload)
- **SlackService**: Envía notificaciones

---

## 10. ✅ No Exponer Datos Sensibles

### Decisión

Respuesta mínima, sin IDs internos.

### Razones

- **Seguridad**: No revelar estructura interna
- **Privacidad**: No exponer datos de otros clientes
- **Simpleza**: Cliente solo necesita confirmación

### Response

```json
{
  "message": "Quote creada exitosamente",
  "quoteNumber": "PQR-...",
  "createdAt": "2024-01-13T10:30:00Z"
}
```

---

## 📋 Resumen de Decisiones

| Decisión      | Opción            | Razón                        |
| ------------- | ----------------- | ---------------------------- |
| Módulo        | Aislado           | Flujos diferentes            |
| Persistencia  | No                | Release inicial              |
| Numeración    | PQR-{ts}-{random} | Único sin BD                 |
| Rate Limit    | 10/min            | Previene abuso               |
| Validación    | Zod               | Consistencia                 |
| Slack         | Reutilizar        | No duplicar                  |
| Autenticación | No                | Acceso público               |
| Arquitectura  | Coordinador       | Separación responsabilidades |
| Datos         | Mínimos           | Seguridad                    |
