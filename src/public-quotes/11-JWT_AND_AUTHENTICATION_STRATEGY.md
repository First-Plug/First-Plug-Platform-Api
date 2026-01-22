# 🔐 JWT y Estrategia de Autenticación - Public Quotes

## 📋 Resumen Ejecutivo

**Public Quotes NO requiere JWT ni autenticación**. Es una URL pública para clientes potenciales sin cuenta.

Sin embargo, **SÍ reutilizamos servicios que internamente pueden usar autenticación** (como SlackService).

---

## 🔍 Análisis de Servicios Reutilizables

### ✅ SlackService (REUTILIZABLE)

**Ubicación**: `src/slack/slack.service.ts`

**Características**:
- ✅ NO requiere autenticación
- ✅ Usa webhooks (configurados en env)
- ✅ Métodos públicos: `sendMessage()`, `sendQuoteMessage()`, `sendOffboardingMessage()`
- ✅ Inyectable en cualquier módulo

**Uso en Public Quotes**:
```typescript
// En PublicQuotesCoordinatorService
constructor(private readonly slackService: SlackService) {}

// Llamada simple, sin JWT
await this.slackService.sendQuoteMessage(payload);
```

**Webhooks Disponibles**:
- `SLACK_WEBHOOK_URL_QUOTES` - Para quotes (logueadas y públicas)
- `SLACK_WEBHOOK_URL_SHIPMENTS` - Para shipments
- `SLACK_WEBHOOK_URL_OFFBOARDING` - Para offboarding

---

## ❌ Servicios NO Reutilizables

### QuotesService (NO REUTILIZAR)

**Razón**: Requiere autenticación y tenant
- Usa `TenantsMiddleware` (requiere JWT)
- Accede a BD de tenant
- Requiere `tenantName` y `userId` del JWT

### HistoryService (NO REUTILIZAR)

**Razón**: Requiere contexto de tenant
- Registra auditoría en BD
- Requiere `tenantName` del JWT
- Public Quotes no persiste datos

### QuotesCoordinatorService (NO REUTILIZAR)

**Razón**: Orquesta servicios que requieren autenticación
- Llama a `QuotesService.create()` (requiere tenant)
- Llama a `HistoryService.record()` (requiere tenant)

---

## 🏗️ Arquitectura de Autenticación

### Quotes Logueadas (Autenticadas)
```
Cliente → JWT Token (Bearer)
    ↓
JwtGuard (valida token)
    ↓
TenantsMiddleware (resuelve tenant)
    ↓
QuotesController
    ↓
QuotesCoordinatorService
    ├─ QuotesService (accede a BD)
    ├─ SlackService (envía notificación)
    └─ HistoryService (registra auditoría)
```

### Public Quotes (SIN Autenticación)
```
Cliente Potencial (sin JWT)
    ↓
Rate Limiting (por IP)
    ↓
Validación Zod
    ↓
PublicQuotesController
    ↓
PublicQuotesCoordinatorService
    └─ SlackService (envía notificación)
```

---

## 🎯 Estrategia: ¿Enviar Token desde Frontend?

### ❌ NO es necesario

**Razones**:
1. **Endpoint público**: No requiere autenticación
2. **Rate limiting por IP**: Protección alternativa
3. **Validación Zod**: Protección de datos
4. **SlackService sin JWT**: Usa webhooks (env vars)

### ✅ Si quisieras agregar token (futuro)

Podrías usar un **token público especial** (no JWT):
```typescript
// Ejemplo: Token público para Public Quotes
const PUBLIC_QUOTES_TOKEN = process.env.PUBLIC_QUOTES_API_KEY;

// En controller
@Post('create')
async create(
  @Headers('x-public-quotes-key') apiKey: string,
  @Body() createDto: CreatePublicQuoteDto,
) {
  if (apiKey !== PUBLIC_QUOTES_TOKEN) {
    throw new UnauthorizedException();
  }
  // ...
}
```

**Pero NO es recomendado** porque:
- Expone el token en frontend
- Rate limiting es suficiente
- Complejidad innecesaria

---

## 🔒 Seguridad Sin Autenticación

### Protecciones Implementadas

1. **Rate Limiting**: 10 req/min por IP
2. **Validación Zod**: Email, nombre, empresa, país
3. **Sanitización**: Trim, validación de longitud
4. **Email Validation**: No @firstplug.com
5. **CORS**: Solo frontend configurado
6. **No Persistencia**: Datos no se guardan en BD
7. **No Acceso a Tenant**: Aislado de datos internos

---

## 📝 Conclusión

**Public Quotes**:
- ✅ NO requiere JWT
- ✅ NO requiere autenticación
- ✅ NO requiere token especial
- ✅ Reutiliza SlackService (sin autenticación)
- ✅ Protegido por rate limiting + validación

**Recomendación**: Mantener simple, sin tokens adicionales.


