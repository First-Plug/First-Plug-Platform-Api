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

### Fase 11: Schema para BD Superior (1 hora)

**Objetivo**: Crear schema MongoDB para public quotes en BD superior (firstPlug.quotes en dev / main.quotes en prod)

**Tareas**:

- [ ] Crear `src/public-quotes/schemas/public-quote.schema.ts`
- [ ] Definir campos: email, fullName, companyName, country, phone, requestType, products, services
- [ ] Agregar campos metadata: quoteNumber, status, notes, createdAt, updatedAt
- [ ] Crear índices: createdAt, email, country, requestType, status
- [ ] Crear interface TypeScript

**Schema**:

```typescript
@Schema({ timestamps: true })
export class PublicQuote {
  _id?: Types.ObjectId;

  // Cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: ProductData[];
  services?: ServiceData[];

  // Metadata
  quoteNumber: string;
  status: 'received' | 'reviewed' | 'responded';
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

### Fase 12: Persistencia en firstPlug (2 horas)

**Objetivo**: Implementar guardado en BD superior

**Tareas**:

- [ ] Inyectar modelo `PublicQuote` en `PublicQuotesService`
- [ ] Implementar `saveToFirstPlug(data)` en servicio raíz
- [ ] Manejar errores de BD (no-blocking)
- [ ] Crear índices automáticamente
- [ ] Loguear guardado exitoso

**Método**:

```typescript
async saveToFirstPlug(data: CreatePublicQuoteDto, quoteNumber: string): Promise<PublicQuote> {
  const publicQuote = new this.publicQuoteModel({
    ...data,
    quoteNumber,
    status: 'received',
  });
  return await publicQuote.save();
}
```

---

### Fase 13: SuperAdmin Endpoints (FUTURAS FASES - No incluido en Fase 1)

**Objetivo**: Crear endpoints para SuperAdmin (para futuras fases)

**Nota**: En Fase 1, NO se implementan endpoints SuperAdmin. Solo persistencia para auditoría y control manual.

**Tareas** (para futuras fases):

- [ ] Crear `public-quotes-superadmin.controller.ts`
- [ ] Crear `public-quotes-superadmin.service.ts`
- [ ] Implementar GET /super-admin/public-quotes (listar)
- [ ] Implementar GET /super-admin/public-quotes/:id (detalle)
- [ ] Implementar PUT /super-admin/public-quotes/:id (actualizar estado/notas)
- [ ] Implementar DELETE /super-admin/public-quotes/:id (archivar)
- [ ] Agregar JWT Guard (solo superadmin)
- [ ] Crear DTOs para respuestas

**Endpoints** (para futuras fases):

```
GET    /super-admin/public-quotes?page=1&limit=20&status=received
GET    /super-admin/public-quotes/:id
PUT    /super-admin/public-quotes/:id { status, notes }
DELETE /super-admin/public-quotes/:id
```

---

### Fase 14: Validación Zod para Offboarding (1 hora)

**Objetivo**: Crear validación Zod para Offboarding Service

**Tareas**:

- [ ] Crear `src/public-quotes/validations/offboarding-service.zod.ts`
- [ ] Definir `OffboardingOriginMemberSchema`
- [ ] Definir `OffboardingDestinationSchema` (discriminated union)
- [ ] Definir `OffboardingProductSchema`
- [ ] Definir `OffboardingServiceSchema` completo
- [ ] Validar campos requeridos: originMember, isSensitiveSituation, employeeKnows, products
- [ ] Validar formato de fecha: desirablePickupDate (YYYY-MM-DD)
- [ ] Validar límite de caracteres: additionalDetails (max 1000)

**Validaciones Clave**:

- originMember: firstName, lastName, email, countryCode (todos requeridos)
- isSensitiveSituation: boolean requerido
- employeeKnows: boolean requerido
- products: array mínimo 1
- destination: type + campos según tipo (Member/Office/Warehouse)

---

### Fase 15: Validación Zod para Logistics (1 hora)

**Objetivo**: Crear validación Zod para Logistics Service

**Tareas**:

- [ ] Crear `src/public-quotes/validations/logistics-service.zod.ts`
- [ ] Definir `LogisticsDestinationSchema` (discriminated union)
- [ ] Definir `LogisticsProductSchema`
- [ ] Definir `LogisticsServiceSchema` completo
- [ ] Validar campos requeridos: products, destination.type, destination.countryCode
- [ ] Validar formato de fecha: desirablePickupDate (YYYY-MM-DD)
- [ ] Validar límite de caracteres: additionalDetails (max 1000)
- [ ] Permitir campos opcionales: productId, productSnapshot, memberId, officeId, warehouseId

**Validaciones Clave**:

- products: array mínimo 1
- destination.type: 'Member' | 'Office' | 'Warehouse'
- destination.countryCode: requerido
- Campos de destino opcionales según tipo

---

### Fase 16: Integración en DTO Principal (1 hora)

**Objetivo**: Actualizar DTO principal para incluir Offboarding y Logistics

**Tareas**:

- [ ] Actualizar `create-public-quote.zod.ts` para incluir ambos servicios
- [ ] Actualizar `CreatePublicQuoteDto` para reflejar cambios
- [ ] Actualizar validación de `requestType` y `services`
- [ ] Crear tests de validación para ambos servicios
- [ ] Validar que la discriminated union funciona correctamente
- [ ] Documentar cambios en comentarios

**Cambios**:

- Agregar `OffboardingServiceSchema` a `ServiceUnion`
- Agregar `LogisticsServiceSchema` a `ServiceUnion`
- Actualizar ejemplos en comentarios

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
- **Fase 11**: 1 hora (Schema BD superior)
- **Fase 12**: 2 horas (Persistencia BD superior)
- **Fase 13**: 2 horas (SuperAdmin Endpoints)
- **Fase 14**: 1 hora (Validación Offboarding)
- **Fase 15**: 1 hora (Validación Logistics)
- **Fase 16**: 1 hora (Integración en DTO)

**Total**: 18-21 horas

---

## ✅ Checklist Final

### Estructura Base

- [ ] Módulo registrado en `app.module.ts`
- [ ] Carpetas y archivos creados
- [ ] Interfaces y DTOs definidos

### Endpoints Públicos

- [ ] Endpoints públicos funcionan sin autenticación
- [ ] Rate limiting activo (10 req/min por IP)
- [ ] Validación Zod funciona para todos los servicios
- [ ] Números PQR generados correctamente

### Servicios Soportados

- [ ] IT Support funciona
- [ ] Enrollment funciona
- [ ] Data Wipe funciona
- [ ] Destruction and Recycling funciona
- [ ] Buyback funciona
- [ ] Donate funciona
- [ ] Cleaning funciona
- [ ] Storage funciona
- [ ] **Offboarding funciona** (originMember, isSensitiveSituation, employeeKnows)
- [ ] **Logistics funciona** (productos con destinos)

### Persistencia

- [ ] Datos guardados en BD superior (firstPlug.quotes en dev / main.quotes en prod)
- [ ] Índices creados en BD (email, country, requestType, status, createdAt)
- [ ] Metadata guardada correctamente (quoteNumber, status, timestamps)

### Notificaciones

- [ ] Mensajes enviados a Slack
- [ ] Formato correcto de mensaje
- [ ] No-blocking (no afecta respuesta)

### Persistencia y Auditoría (Fase 1)

- [ ] Datos guardados en BD superior (firstPlug.quotes / main.quotes)
- [ ] Índices creados en BD
- [ ] Verificación manual: contar docs en BD vs mensajes en Slack
- [ ] Integridad validada

### SuperAdmin (FUTURAS FASES - No en Fase 1)

- [ ] SuperAdmin endpoints funcionan (futuras fases)
- [ ] SuperAdmin puede ver/editar public quotes (futuras fases)
- [ ] Filtros funcionan (status, country, requestType) (futuras fases)
- [ ] Paginación funciona (futuras fases)

### Testing

- [ ] Tests pasan (públicos + superadmin)
- [ ] Tests para Offboarding
- [ ] Tests para Logistics
- [ ] Tests de validación Zod
- [ ] Tests de rate limiting

### Documentación y Seguridad

- [ ] Documentación completa
- [ ] Sin errores en logs
- [ ] Seguridad validada (JWT, rate limiting, validación)
- [ ] Offboarding y Logistics documentados
- [ ] Ejemplos de request/response incluidos

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
