# 📊 Public Quotes Feature - Resumen Ejecutivo

## 🎯 Objetivo

Crear una URL pública donde clientes potenciales (sin login) puedan solicitar presupuestos de productos y servicios. Los datos se envían a Slack pero **NO se persisten en BD** en este release.

---

## 🏗️ Decisiones Clave

### 1. **Módulo Aislado**

- ✅ Crear `PublicQuotesModule` separado de `QuotesModule`
- ✅ Razón: Flujos, seguridad y datos completamente diferentes
- ✅ Evita acoplamiento innecesario

### 2. **Arquitectura de Servicios**

```
PublicQuotesController (sin autenticación)
    ↓
PublicQuotesCoordinatorService (orquestación)
    ├─ PublicQuotesService (raíz - lógica core)
    └─ SlackService (notificación)
```

### 3. **Sin Persistencia en BD**

- ✅ Datos NO se guardan en base de datos
- ✅ Solo se envían a Slack
- ✅ Simplifica arquitectura para release inicial

### 4. **Numeración Única**

- ✅ Formato: `PQR-{timestamp}-{random}`
- ✅ Ejemplo: `PQR-1705123456789-A7K2`
- ✅ No requiere BD, único garantizado

### 5. **Datos Requeridos**

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

**IMPORTANTE**: Offboarding NO está disponible para quotes públicas (solo usuarios logueados)

---

## 🔐 Seguridad

### Protecciones

1. **Rate Limiting**: 10 requests/minuto por IP
2. **Validación Zod**: Email, nombre, empresa, país
3. **Sanitización**: Trim, validación de longitud
4. **CORS**: Solo frontend configurado
5. **No exponer datos**: Respuesta mínima

### Datos Sensibles

- ❌ NO retornar IDs internos
- ❌ NO retornar info de otros clientes
- ❌ NO loguear datos personales

---

## 📦 Reutilización

### SlackService

- ✅ Usar método `sendQuoteMessage()` existente
- ✅ Webhook: `SLACK_WEBHOOK_URL_QUOTES`
- ✅ No-blocking: errores no detienen flujo

### Validaciones

- ✅ Reutilizar helpers de país
- ✅ Crear schemas Zod específicos

### Productos/Servicios

- ✅ Mismo formato que quotes logueadas
- ✅ Reutilizar interfaces existentes

---

## 🚀 Flujo de Implementación

### Fase 1: Estructura Base

1. Crear módulo `PublicQuotesModule`
2. Crear servicios (raíz + coordinador)
3. Crear controller con endpoints públicos

### Fase 2: Validaciones y DTOs

1. Crear schemas Zod
2. Crear DTOs
3. Implementar validaciones

### Fase 3: Lógica Core

1. Generador de números PQR
2. Preparación de payload Slack
3. Integración con SlackService

### Fase 4: Seguridad

1. Rate limiting
2. Sanitización de inputs
3. Protecciones CORS

### Fase 5: Testing

1. Tests unitarios
2. Tests de integración
3. Tests de seguridad

---

## 📋 Endpoints

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
  "products": [...],
  "services": [...]
}
```

Response (201):

```json
{
  "message": "Quote creada exitosamente",
  "quoteNumber": "PQR-1705123456789-A7K2",
  "createdAt": "2024-01-13T10:30:00Z"
}
```

---

## ✅ Checklist

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
3. **Reutilización**: SlackService, validaciones, interfaces
4. **Seguridad**: Rate limiting, validación, sanitización
5. **Simplicidad**: Sin BD, sin tenant, sin autenticación
6. **Observabilidad**: Logs estructurados
