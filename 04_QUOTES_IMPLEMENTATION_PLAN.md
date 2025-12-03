# 🚀 03 - Plan de Implementación - Feature Quotes (MVP)

## 📋 Fases de Implementación

### Fase 1: Estructura Base

- [ ] Crear carpeta `src/quotes/`
- [ ] Crear subcarpetas: `schemas`, `dto`, `interfaces`, `services`, `controllers`
- [ ] Crear `quotes.module.ts`

### Fase 2: Schema MongoDB

- [ ] Crear `src/quotes/schemas/quote.schema.ts`
- [ ] Definir interfaz `Quote`
- [ ] Implementar soft delete
- [ ] Agregar índices (userEmail, createdAt, requestID)
- [ ] **Nota**: Las quotes se guardan en colección dentro de cada tenant (no filtrar por tenantId)

### Fase 3: Interfaces y Validaciones - Primer Release

- [ ] Crear `src/quotes/interfaces/request-data.interface.ts`

  - [ ] `ProductoData` (solo Producto en primer release)
  - [ ] `RequestData` type

- [ ] Crear `src/quotes/dto/create-quote.dto.ts`
- [ ] Crear `src/quotes/dto/quote-response.dto.ts`
- [ ] Crear `src/quotes/schemas/request-data.schema.ts` (Zod)
  - [ ] Validar `ProductoData` con campos: category, brand, model, quantity, additionalInfo, priority
  - [ ] Validar delivery info: city, country, date
  - [ ] Validar que items array no esté vacío

### Fase 4: Servicios - Primer Release

- [ ] Crear `src/quotes/services/quotes.service.ts` (ROOT)

  - `create(tenantConnection, createQuoteDto)` - Generar requestID automático
  - `findAll(tenantConnection, filters)` - Listar quotes del usuario
  - `findById(tenantConnection, quoteId)` - Obtener quote específico
  - `softDelete(tenantConnection, quoteId)` - Soft delete

- [ ] Crear `src/quotes/services/quotes-coordinator.service.ts` (TRANSVERSAL)
  - `submitQuote(tenantConnection, quote)` - Coordinar creación
  - Integrar con SlackService para notificación
  - Integrar con HistoryService para auditoría
  - **Nota**: Usar tenantConnection en lugar de tenantId

### Fase 5: Controller - Primer Release

- [ ] Crear `src/quotes/controllers/quotes.controller.ts`
  - `POST /quotes` - Crear quote (Producto)
  - `GET /quotes` - Listar quotes del usuario
  - `GET /quotes/:id` - Obtener quote específico
  - `DELETE /quotes/:id` - Soft delete de quote
  - **Nota**: Usar tenantConnection del contexto

### Fase 6: Integración Slack - Primer Release

- [ ] Crear método para formatear mensaje de Producto
- [ ] Enviar a canal `#quotes`
- [ ] Manejar errores de Slack (no bloquear creación)
- [ ] Incluir: requestID, tipo, items, prioridad, usuario, link

### Fase 7: Integración History

- [ ] Registrar creación de quote
- [ ] Registrar eliminación de quote
- [ ] Incluir detalles relevantes

### Fase 8: Tests

- [ ] Tests unitarios para `QuotesService`
- [ ] Tests unitarios para `QuotesCoordinatorService`
- [ ] Tests de integración para endpoints
- [ ] Tests de Slack notification

### Fase 9: Documentación

- [ ] Documentar endpoints en Swagger
- [ ] Documentar schema
- [ ] Documentar flujo de creación

---

## 🔄 Flujo de Creación de Quote

```
1. Usuario envía POST /quotes con CreateQuoteDto
   ↓
2. Controller valida DTO
   ↓
3. QuotesCoordinatorService.submitQuote() es llamado
   ↓
4. QuotesService.create() guarda en BD
   ↓
5. SlackService.sendMessage() envía notificación
   ↓
6. HistoryService.log() registra el evento
   ↓
7. Response con quote creado
```

---

## 📁 Estructura de Carpetas Final

```
src/quotes/
├── schemas/
│   ├── quote.schema.ts              # MongoDB schema
│   └── request-data.schema.ts       # Zod validation schemas
├── interfaces/
│   ├── quote.interface.ts           # Quote interface
│   └── request-data.interface.ts    # RequestData types (Discriminated Union)
├── dto/
│   ├── create-quote.dto.ts
│   └── quote-response.dto.ts
├── services/
│   ├── quotes.service.ts            # ROOT service
│   └── quotes-coordinator.service.ts # TRANSVERSAL service
├── controllers/
│   └── quotes.controller.ts
└── quotes.module.ts
```

---

## 🔑 Consideraciones Importantes

1. **Multi-tenant**: Las quotes se guardan en una colección dentro de cada tenant
   - NO hay filtrado por `tenantId` en queries
   - Se usa `TenantConnectionService` para acceder a la BD del tenant
   - Cada tenant tiene su propia colección `quotes`
2. **Soft Delete**: Usar `isDeleted` flag en lugar de eliminar
3. **Validación**: Validar `requestData` según `requestType` (solo Producto en primer release)
4. **Slack**: Usar canal `#quotes` (crear si no existe)
5. **History**: Registrar todas las operaciones
6. **Error Handling**: Manejar errores de BD, Slack, etc.
7. **RequestID**: Generar automáticamente con formato QR-YYYY-NNN (secuencial por tenant)

---

**Próximo paso**: Lee 04_QUOTES_FINAL_QUESTIONS.md
