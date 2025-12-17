# 📋 Plan de Desarrollo - Quotes Feature

## ✅ Fase 1: Estructura Base (COMPLETADA)

- [x] Schema de Quote
- [x] DTO de Create/Update
- [x] Validaciones Zod
- [x] QuotesService (CRUD)
- [x] QuotesCoordinatorService (coordinación)
- [x] QuotesController (endpoints)
- [x] Integración con HistoryService
- [x] Integración con SlackService

## ✅ Fase 2: RequestId Incremental (COMPLETADA)

- [x] Reutiliza colección `shipmentmetadata` existente
- [x] Método `generateRequestId()` atómico
- [x] Garantiza unicidad incluso con deletes
- [x] No hay race conditions
- [x] Formato: `QR-{tenantName}-{000001}`

### Cómo Funciona el RequestId

**Problema Anterior:**

```typescript
// ❌ NO SEGURO - Puede repetir números si borras quotes
const lastQuote = await QuoteModel.findOne().sort({ createdAt: -1 });
let nextNumber = parseInt(lastQuote.requestId.match(/\d+/)[0]) + 1;
```

**Solución Implementada (Reutiliza ShipmentMetadata):**

```typescript
// ✅ SEGURO - Usa colección shipmentmetadata (misma que Shipments)
const MetadataModel = connection.model(
  'ShipmentMetadata',
  ShipmentMetadataSchema,
  'shipmentmetadata',
);

const metadata = await MetadataModel.findByIdAndUpdate(
  'quote_counter', // Registro separado del orderCounter
  { $inc: { lastQuoteNumber: 1 } },
  { new: true, upsert: true },
);
const nextNumber = metadata.lastQuoteNumber;
```

**Ventajas:**

- ✅ Operación atómica (no hay race conditions)
- ✅ Incremental garantizado
- ✅ Nunca repite números (incluso si borras quotes)
- ✅ Reutiliza colección existente (no crea nuevas)
- ✅ Patrón consistente con Shipments

## ✅ Fase 3: Validación en Controller (COMPLETADA)

- [x] Aplicar validaciones Zod en endpoints
- [x] Validar CreateQuoteDto en POST /quotes
- [x] Validar UpdateQuoteDto en PATCH /quotes/:id
- [x] Validar formato de ID en GET/PATCH/DELETE
- [x] Manejo de errores de validación Zod
- [x] Método validateObjectId() para reutilizar

## 📋 Fase 4: Tests Unitarios

- [ ] Tests para QuotesService
- [ ] Tests para QuotesCoordinatorService
- [ ] Tests para generateRequestId (concurrencia)
- [ ] Tests para endpoints

## 📋 Fase 5: Documentación Swagger

- [ ] Decoradores @ApiOperation
- [ ] Decoradores @ApiResponse
- [ ] Documentación de DTOs
- [ ] Ejemplos de requests/responses

## 📋 Fase 6: Mejoras Futuras

- [ ] Filtros avanzados (por estado, fecha, etc)
- [ ] Paginación
- [ ] Búsqueda por requestId
- [ ] Exportar quotes a PDF
- [ ] Notificaciones por email

---

## 🎯 Próximo Paso: Fase 3

**Objetivo:** Aplicar validaciones Zod en los endpoints del controller

**Archivos a modificar:**

- `src/quotes/quotes.controller.ts` - Agregar validación en POST/PATCH

**Validaciones a aplicar:**

- CreateQuoteDto: validar estructura de products
- UpdateQuoteDto: validar campos actualizables
- Manejo de errores: retornar mensajes claros

**Ejemplo:**

```typescript
@Post()
async create(
  @Body() createQuoteDto: CreateQuoteDto, // ← Validar aquí
  @Req() req: any,
) {
  // Validar con Zod
  const validated = CreateQuoteSchema.parse(createQuoteDto);
  return this.quotesCoordinatorService.create(validated, ...);
}
```

---

## 📊 Estado Actual

| Componente  | Estado | Notas                            |
| ----------- | ------ | -------------------------------- |
| Schema      | ✅     | Quote + QuoteCounter             |
| Service     | ✅     | CRUD + generateRequestId atómico |
| Coordinator | ✅     | Integración con History/Slack    |
| Controller  | ⚠️     | Sin validación Zod               |
| Tests       | ❌     | No implementados                 |
| Swagger     | ❌     | No documentado                   |

---

## 🔐 Garantías del RequestId

```
Escenario 1: Crear 3 quotes
QR-mechi_test-000001 ✅
QR-mechi_test-000002 ✅
QR-mechi_test-000003 ✅

Escenario 2: Borrar quote #2, crear nuevo
QR-mechi_test-000001 ✅
QR-mechi_test-000002 ❌ (BORRADO)
QR-mechi_test-000003 ✅
QR-mechi_test-000004 ✅ (NUEVO - nunca repite #2)

Escenario 3: Requests simultáneos
Request A: QR-mechi_test-000005 ✅
Request B: QR-mechi_test-000006 ✅ (no colisiona)
```
