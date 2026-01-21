# 🗺️ Public Quotes - Roadmap de Implementación

## 📚 Documentación Disponible

Antes de empezar, lee estos documentos en orden:

1. **README.md** - Inicio rápido
2. **PLAN_SUMMARY.md** - Resumen ejecutivo
3. **KEY_DECISIONS.md** - Decisiones clave
4. **ARCHITECTURE_PLAN.md** - Arquitectura detallada
5. **TECHNICAL_DETAILS.md** - Detalles técnicos
6. **COMPARISON_QUOTES.md** - Comparación con quotes logueadas
7. **CODE_EXAMPLES.md** - Ejemplos de código

---

## 🚀 Fases de Implementación

### Fase 1: Estructura Base (1-2 horas)

**Objetivo**: Crear estructura de carpetas y módulo base

**Tareas**:

- [ ] Crear carpeta `src/public-quotes/`
- [ ] Crear `public-quotes.module.ts`
- [ ] Crear `public-quotes.service.ts` (vacío)
- [ ] Crear `public-quotes-coordinator.service.ts` (vacío)
- [ ] Crear `public-quotes.controller.ts` (vacío)
- [ ] Crear carpetas: `dto/`, `validations/`, `helpers/`, `interfaces/`
- [ ] Registrar módulo en `app.module.ts`

**Archivos a crear**:

```
src/public-quotes/
├── public-quotes.module.ts
├── public-quotes.service.ts
├── public-quotes-coordinator.service.ts
├── public-quotes.controller.ts
├── dto/
├── validations/
├── helpers/
└── interfaces/
```

---

### Fase 2: Interfaces y DTOs (1 hora)

**Objetivo**: Definir estructura de datos

**Tareas**:

- [ ] Crear `interfaces/public-quote.interface.ts`
- [ ] Crear `dto/create-public-quote.dto.ts` (incluir requestType)
- [ ] Crear `dto/public-quote-response.dto.ts`
- [ ] Crear `validations/create-public-quote.zod.ts`

**Campos del DTO**:

```
✅ email (validado, no @firstplug.com)
✅ fullName (2-100 chars, trim)
✅ companyName (2-100 chars, trim)
✅ country (código ISO)
❌ phone (opcional)
✅ requestType ('product' | 'service' | 'mixed')
✅ products (array, si requestType incluye 'product')
✅ services (array, si requestType incluye 'service', SIN Offboarding)
```

**Validaciones Críticas**:

- Si requestType es 'product' o 'mixed' → products NO vacío
- Si requestType es 'service' o 'mixed' → services NO vacío
- NO permitir serviceCategory === 'Offboarding'

**Referencia**: Ver `CODE_EXAMPLES.md`

---

### Fase 3: Servicio Raíz (1-2 horas)

**Objetivo**: Implementar lógica core

**Tareas**:

- [ ] Implementar `generatePublicQuoteNumber()`
- [ ] Implementar `prepareSlackPayload()`
- [ ] Agregar logger
- [ ] Agregar validaciones básicas

**Métodos principales**:

```typescript
generatePublicQuoteNumber(): string
prepareSlackPayload(quoteNumber, data): any
```

---

### Fase 4: Coordinador (1 hora)

**Objetivo**: Orquestar flujo

**Tareas**:

- [ ] Inyectar `PublicQuotesService`
- [ ] Inyectar `SlackService`
- [ ] Implementar `createPublicQuoteWithCoordination()`
- [ ] Manejar errores de Slack (no-blocking)

**Método principal**:

```typescript
async createPublicQuoteWithCoordination(
  createDto: CreatePublicQuoteDto
): Promise<PublicQuoteResponseDto>
```

---

### Fase 5: Controller (1 hora)

**Objetivo**: Crear endpoints públicos

**Tareas**:

- [ ] Crear endpoint `POST /api/public-quotes/create`
- [ ] Agregar validación Zod
- [ ] Agregar rate limiting
- [ ] Manejar errores

**Endpoint**:

```
POST /api/public-quotes/create
Sin autenticación
Rate limit: 10 req/min
```

---

### Fase 6: Helpers (30 min)

**Objetivo**: Crear funciones auxiliares

**Tareas**:

- [ ] Crear `helpers/generate-public-quote-number.ts`
- [ ] Crear `helpers/create-public-quote-message-to-slack.ts`
- [ ] Reutilizar helpers de país si es necesario

---

### Fase 7: Seguridad (1 hora)

**Objetivo**: Implementar protecciones

**Tareas**:

- [ ] Configurar rate limiting en controller
- [ ] Validar email (no @firstplug.com)
- [ ] Sanitizar inputs (trim, longitud)
- [ ] Validar país (código ISO o nombre)
- [ ] Validar requestType ('product' | 'service' | 'mixed')
- [ ] Validar que NO haya Offboarding en services
- [ ] Validar que products/services no estén vacíos según requestType
- [ ] Proteger CORS

---

### Fase 8: Integración Slack (30 min)

**Objetivo**: Conectar con SlackService

**Tareas**:

- [ ] Verificar `SlackService.sendQuoteMessage()` existe
- [ ] Crear payload correcto
- [ ] Manejar errores de Slack
- [ ] Loguear envíos

---

### Fase 9: Testing (2-3 horas)

**Objetivo**: Escribir tests

**Tareas**:

- [ ] Tests unitarios para `PublicQuotesService`
- [ ] Tests unitarios para `PublicQuotesCoordinatorService`
- [ ] Tests de integración para controller
- [ ] Tests de validación Zod
- [ ] Tests de rate limiting
- [ ] Tests de seguridad

---

### Fase 10: Documentación (30 min)

**Objetivo**: Documentar API

**Tareas**:

- [ ] Documentar endpoint en Swagger/OpenAPI
- [ ] Crear ejemplos de request/response
- [ ] Documentar errores posibles
- [ ] Crear guía de uso

---

## ⏱️ Estimación Total

- **Fase 1**: 1-2 horas
- **Fase 2**: 1 hora
- **Fase 3**: 1-2 horas
- **Fase 4**: 1 hora
- **Fase 5**: 1 hora
- **Fase 6**: 30 min
- **Fase 7**: 1 hora
- **Fase 8**: 30 min
- **Fase 9**: 2-3 horas
- **Fase 10**: 30 min

**Total**: 9-12 horas

---

## ✅ Checklist Final

- [ ] Módulo registrado en `app.module.ts`
- [ ] Endpoints funcionan sin autenticación
- [ ] Rate limiting activo
- [ ] Validación Zod funciona
- [ ] Números PQR generados correctamente
- [ ] Mensajes enviados a Slack
- [ ] Tests pasan
- [ ] Documentación completa
- [ ] Sin errores en logs
- [ ] Seguridad validada

---

## 🔗 Próximos Pasos

Después de implementar:

1. **Testing en desarrollo**: Probar flujo completo
2. **Testing en staging**: Validar con datos reales
3. **Feedback del equipo**: Ajustes necesarios
4. **Deploy a producción**: Cuando esté listo
5. **Monitoreo**: Vigilar logs y Slack

---

## 📞 Soporte

Si tienes dudas durante la implementación:

1. Revisa los documentos de referencia
2. Consulta `CODE_EXAMPLES.md` para ejemplos
3. Compara con `QuotesModule` para patrones similares
4. Revisa `.augment-config.md` para reglas de arquitectura
