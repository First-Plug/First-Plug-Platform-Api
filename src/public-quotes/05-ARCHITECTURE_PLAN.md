# 🌐 Public Quotes Feature - Plan de Arquitectura

## 📋 Resumen Ejecutivo

Feature para crear quotes públicas (sin autenticación) desde una URL pública. Los datos se envían a Slack pero **NO se persisten en BD** en este release inicial.

### Diferencias vs Quotes Logueadas

| Aspecto | Quotes Logueadas | Quotes Públicas |
|---------|------------------|-----------------|
| **Autenticación** | ✅ JWT requerido | ❌ Sin autenticación |
| **Persistencia** | ✅ Guardadas en BD | ❌ NO se guardan |
| **Tenant** | ✅ Asociadas a tenant | ❌ Sin tenant |
| **Numeración** | QR-{tenantName}-{autoIncrement} | PQR-{timestamp}-{random} |
| **Datos extras** | Email, nombre, empresa, país, teléfono | ✅ Todos requeridos |
| **Destino** | Slack + BD | ✅ Solo Slack |

---

## 🏗️ Decisiones de Arquitectura

### 1. **Módulo Aislado (NO reutilizar QuotesModule)**

**Razón**: Aunque comparten lógica, las quotes públicas tienen:
- Flujo diferente (sin BD)
- Seguridad diferente (sin autenticación)
- Numeración diferente
- Datos diferentes

**Estructura**:
```
src/public-quotes/
├── public-quotes.module.ts
├── public-quotes.service.ts          (Servicio raíz)
├── public-quotes-coordinator.service.ts (Coordinador)
├── public-quotes.controller.ts       (Endpoints públicos)
├── dto/
│   ├── create-public-quote.dto.ts
│   └── public-quote-response.dto.ts
├── validations/
│   └── create-public-quote.zod.ts
├── helpers/
│   ├── generate-public-quote-number.ts
│   └── create-public-quote-message-to-slack.ts
└── interfaces/
    └── public-quote.interface.ts
```

### 2. **Servicios por Capas**

#### **Servicio Raíz: PublicQuotesService**
- ✅ Generar número de quote (PQR-{timestamp}-{random})
- ✅ Validar datos de cliente potencial
- ✅ Preparar payload para Slack
- ❌ NO persistir en BD
- ❌ NO acceder a tenant

#### **Coordinador: PublicQuotesCoordinatorService**
- ✅ Orquestar creación de quote
- ✅ Llamar a SlackService para notificación
- ✅ Manejar errores de Slack (no-blocking)
- ✅ Reutilizar SlackService existente

### 3. **Seguridad (CRÍTICO)**

#### **Protecciones Implementadas**:
1. **Rate Limiting**: Máximo 10 requests/minuto por IP
2. **Validación de Email**: Formato válido, no emails de FirstPlug
3. **Sanitización**: Trim, validación de longitud
4. **CORS**: Solo desde frontend configurado
5. **No exponer datos sensibles**: Respuesta mínima

#### **Datos Requeridos**:
```typescript
{
  email: string;           // Validado
  fullName: string;        // Trim, 2-100 chars
  companyName: string;     // Trim, 2-100 chars
  country: string;         // Código ISO o nombre
  phone?: string;          // Opcional, validado
  products?: Product[];    // Array de productos
  services?: Service[];    // Array de servicios
}
```

### 4. **Numeración de Quotes Públicas**

**Formato**: `PQR-{timestamp}-{random}`

Ejemplo: `PQR-1705123456789-A7K2`

**Ventajas**:
- ✅ Único sin BD
- ✅ Timestamp para ordenamiento
- ✅ Random para evitar predicción
- ✅ Corto y legible

---

## 🔄 Flujo de Creación

```
1. Cliente accede a URL pública
2. Completa formulario con datos
3. POST /api/public-quotes/create
   ├─ Validar datos (Zod)
   ├─ Generar número PQR
   ├─ Preparar payload Slack
   ├─ Enviar a Slack (no-blocking)
   └─ Retornar confirmación
4. Respuesta: { message, quoteNumber }
```

---

## 📦 Reutilización de Servicios

### SlackService
- ✅ Usar `sendQuoteMessage()` existente
- ✅ Crear nuevo método `sendPublicQuoteMessage()` si es necesario
- ✅ Usar webhook `SLACK_WEBHOOK_URL_QUOTES`

### Validaciones
- ✅ Reutilizar helpers de país (countryCodes)
- ✅ Crear schemas Zod específicos para public quotes

---

## 🚨 Consideraciones Especiales

1. **Sin Middleware de Tenant**: Endpoints públicos NO usan TenantsMiddleware
2. **Sin JWT Guard**: Endpoints públicos NO usan JwtGuard
3. **Sin Persistencia**: Datos NO se guardan en BD
4. **Slack es crítico**: Si Slack falla, la quote se pierde (aceptable en release inicial)
5. **Datos de cliente**: Nunca exponer información de otros clientes

---

## ✅ Checklist de Implementación

- [ ] Crear módulo `PublicQuotesModule`
- [ ] Crear `PublicQuotesService` (raíz)
- [ ] Crear `PublicQuotesCoordinatorService` (coordinador)
- [ ] Crear `PublicQuotesController` (endpoints públicos)
- [ ] Crear DTOs y validaciones Zod
- [ ] Implementar generador de números PQR
- [ ] Implementar rate limiting
- [ ] Crear helpers para mensaje Slack
- [ ] Integrar con SlackService
- [ ] Escribir tests
- [ ] Documentar endpoints


