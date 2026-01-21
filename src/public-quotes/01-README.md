# 🌐 Public Quotes Feature

## 📖 Documentación

Este módulo implementa quotes públicas (sin autenticación) para clientes potenciales.

### Documentos Disponibles

1. **[PLAN_SUMMARY.md](./PLAN_SUMMARY.md)** - Resumen ejecutivo (LEER PRIMERO)
2. **[ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md)** - Decisiones de arquitectura
3. **[TECHNICAL_DETAILS.md](./TECHNICAL_DETAILS.md)** - Detalles técnicos
4. **[COMPARISON_QUOTES.md](./COMPARISON_QUOTES.md)** - Comparación con quotes logueadas
5. **[CODE_EXAMPLES.md](./CODE_EXAMPLES.md)** - Ejemplos de código

---

## 🎯 Objetivo

Permitir que clientes potenciales (sin login) soliciten presupuestos de productos y servicios a través de una URL pública.

---

## 🔑 Características Clave

✅ **URL Pública**: Sin autenticación requerida
✅ **Datos Requeridos**: Email, nombre, empresa, país, teléfono (opcional)
✅ **Tipo de Solicitud**: 'product' | 'service' | 'mixed'
✅ **Productos**: Computer, Monitor, Audio, Peripherals, Merchandising, Phone, Furniture, Tablet, Other
✅ **Servicios**: IT Support, Enrollment, Data Wipe, Destruction, Buyback, Donate, Cleaning, Storage (NO Offboarding)
✅ **Numeración Única**: `PQR-{timestamp}-{random}`
✅ **Envío a Slack**: Notificación automática a FirstPlug
✅ **Sin Persistencia**: Datos NO se guardan en BD (release inicial)
✅ **Seguridad**: Rate limiting, validación, sanitización
✅ **Módulo Aislado**: Separado de quotes logueadas

---

## 🏗️ Arquitectura

```
PublicQuotesController (sin autenticación)
    ↓
PublicQuotesCoordinatorService (orquestación)
    ├─ PublicQuotesService (lógica core)
    └─ SlackService (notificación)
```

### Servicios

- **PublicQuotesService** (Raíz): Generar números, preparar payloads
- **PublicQuotesCoordinatorService** (Coordinador): Orquestar flujo
- **SlackService** (Reutilizado): Enviar notificaciones

---

## 📊 Comparación

| Aspecto       | Quotes Logueadas  | Quotes Públicas    |
| ------------- | ----------------- | ------------------ |
| Autenticación | ✅ JWT            | ❌ No              |
| Persistencia  | ✅ BD             | ❌ No              |
| Tenant        | ✅ Sí             | ❌ No              |
| Numeración    | QR-{tenant}-{num} | PQR-{ts}-{random}  |
| Módulo        | QuotesModule      | PublicQuotesModule |

---

## 🚀 Endpoints

### POST /api/public-quotes/create

**Sin autenticación**

Request:

```json
{
  "email": "cliente@empresa.com",
  "fullName": "Juan Pérez",
  "companyName": "Empresa XYZ",
  "country": "AR",
  "phone": "+54 9 11 1234-5678",
  "requestType": "mixed",
  "products": [...],
  "services": [...]
}
```

**requestType**: 'product' | 'service' | 'mixed'

- **product**: Solo productos
- **service**: Solo servicios (excepto Offboarding)
- **mixed**: Productos y servicios

Response (201):

```json
{
  "message": "Quote creada exitosamente",
  "quoteNumber": "PQR-1705123456789-A7K2",
  "createdAt": "2024-01-13T10:30:00Z"
}
```

---

## 🔐 Seguridad

- ✅ Rate Limiting: 10 requests/minuto por IP
- ✅ Validación Zod: Email, nombre, empresa, país
- ✅ Sanitización: Trim, validación de longitud
- ✅ CORS: Solo frontend configurado
- ✅ No exponer datos: Respuesta mínima

---

## 📦 Estructura de Carpetas

```
src/public-quotes/
├── public-quotes.module.ts
├── public-quotes.service.ts
├── public-quotes-coordinator.service.ts
├── public-quotes.controller.ts
├── dto/
├── validations/
├── helpers/
├── interfaces/
└── [documentación]
```

---

## ✅ Checklist de Implementación

- [ ] Crear estructura de carpetas
- [ ] Crear módulo y servicios
- [ ] Crear controller y endpoints
- [ ] Crear DTOs y validaciones
- [ ] Implementar generador PQR
- [ ] Integrar con Slack
- [ ] Implementar rate limiting
- [ ] Escribir tests
- [ ] Documentar API

---

## 🎓 Principios Aplicados

1. **Modularización**: Módulo aislado, no acoplado
2. **Separación de responsabilidades**: Servicios raíz vs coordinadores
3. **Reutilización**: SlackService, interfaces, validaciones
4. **Seguridad**: Rate limiting, validación, sanitización
5. **Simplicidad**: Sin BD, sin tenant, sin autenticación
6. **Observabilidad**: Logs estructurados

---

## 📝 Notas Importantes

- **Sin Persistencia**: Datos NO se guardan en BD en este release
- **Slack es crítico**: Si Slack falla, la quote se pierde (aceptable)
- **Módulo Aislado**: Cambios futuros no afectan quotes logueadas
- **Reutilización**: SlackService, interfaces de productos/servicios
- **Seguridad**: Rate limiting, validación, sanitización

---

## 🔗 Referencias

- Documentación de Quotes Logueadas: `src/quotes/`
- SlackService: `src/slack/slack.service.ts`
- Configuración: `.augment-config.md`
