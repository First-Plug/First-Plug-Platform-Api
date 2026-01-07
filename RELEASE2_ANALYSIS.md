# RELEASE 2: IT SUPPORT ATTACHMENTS - ANÁLISIS Y PLAN

## ⚡ RESUMEN EJECUTIVO

| Aspecto               | Decisión                                                         |
| --------------------- | ---------------------------------------------------------------- |
| Objetivo              | Permitir adjuntar imágenes a IT Support dentro de Quotes         |
| Scope Release 2       | Solo imágenes (no video)                                         |
| Storage MVP           | Cloudinary                                                       |
| Costo esperado        | $0 dentro del free tier (créditos mensuales)                     |
| Tiempo implementación | 7–10 días                                                        |
| Plan de salida        | S3-compatible (R2 / S3 / B2)                                     |
| Impacto arquitectura  | Mínimo: extender ITSupportServiceSchema + agregar upload/cleanup |
| Enfoque técnico       | Desacoplado con StorageProvider (Cloudinary hoy, S3 mañana)      |

---

## 🏗️ CONTEXTO REAL DEL PROYECTO

Arquitectura existente:

- Quote es el agregado raíz
- Quote.services[] usa subdocumentos discriminados por serviceCategory
- ITSupportServiceSchema extiende BaseServiceSchema
- Multitenant: cada tenant tiene su DB; Quote guarda tenantId y tenantName
- Slack ya integrado al flujo de Quotes (webhook)
- No existe módulo independiente de IT Support

**Conclusión**: Los adjuntos viven dentro del servicio IT Support, dentro del Quote, sin crear un "módulo IT Support".

---

## 📋 DECISIONES CERRADAS (RELEASE 2)

✅ Adjuntos solo para serviceCategory = 'IT Support'
✅ Solo imágenes (video queda fuera)
✅ Tamaño máximo por imagen: 5 MB
✅ Máximo 4 imágenes por servicio IT Support (por quote)
✅ Resize/optimización obligatoria: máx 1920px
✅ Retención: 30 días desde creación del quote (MVP simple)
✅ Cloudinary como storage MVP
✅ Diseño preparado para migrar (sin refactor masivo)

---

## ❓ ¿Por qué NO video en Release 2?

Video:

- consume mucho más bandwidth
- rompe cualquier free tier rápido
- complica UX (upload largo, progreso, fallos)
- complica Slack (preview menos consistente)
- cambia el cálculo de costos por orden de magnitud

**Decisión consciente**: Imágenes primero. Video = Release 3 con análisis propio.

---

## 🏆 OPCIONES DE STORAGE ANALIZADAS

### Opción A — Cloudinary (MVP)

**Pros**

- CDN incluido
- compresión/formatos automáticos
- URLs fáciles para Slack
- implementación rápida
- free tier suficiente si controlamos límites

**Contras**

- Free tier basado en créditos mensuales (pool: storage + bandwidth + transforms)
- Preview Slack depende de que las URLs sean accesibles (no garantizado)
- Retención requiere cron propio (no asumir "auto-delete mágico")

**Ideal para MVP y bajo uso inicial.**

---

### Opción B — S3-compatible + lifecycle (plan de salida)

Incluye: AWS S3, Cloudflare R2, Backblaze B2 (S3 API)

**Pros**

- Lifecycle rules (borrado automático sin cron si querés)
- muy escalable
- costos predecibles a gran escala

**Contras**

- más setup (IAM, CORS, signed URLs)
- Slack preview puede ser más delicado (URLs firmadas)
- más tiempo de implementación

**Ideal cuando**: muchos tenants, muchos adjuntos, entra video, o Cloudinary deja de ser conveniente.

---

## 🧠 DECISIÓN ARQUITECTÓNICA

Release 2 = Cloudinary con límites estrictos + diseño migrable.
No se "piensa chico": se implementa simple, pero se diseña para crecer.

---

## ✅ ACLARACIONES CLAVE

**1) ¿Guardar "solo URL + type" alcanza?**
No. Para eliminar un archivo en Cloudinary, necesitás guardar publicId.

**Guardamos**:

- publicId (clave de borrado)
- secureUrl (para Slack / UI)
- mimeType, bytes, timestamps

**2) ¿Cloudinary borra con una URL tipo /api/delete/url-del-recurso?**
No. El borrado se hace con su API/SDK autenticado por publicId (destroy(publicId)).

**3) ¿Por qué un "provider/adapter"?**
Permite: hoy Cloudinary, mañana S3-compatible, sin tocar Quotes ni schemas.

---

## 🔧 CAMBIOS DE SCHEMA (FINAL)

### AttachmentSchema (nuevo)

```typescript
@Schema({ _id: false })
export class AttachmentSchema {
  @Prop({ type: String, required: true })
  provider: 'cloudinary'; // futuro: 's3'

  @Prop({ type: String, required: true })
  publicId: string;

  @Prop({ type: String, required: true })
  secureUrl: string;

  @Prop({ type: String, required: true })
  mimeType: string;

  @Prop({ type: Number, required: true })
  bytes: number;

  @Prop({ type: String })
  originalName?: string;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}
```

### Extensión de ITSupportServiceSchema

```typescript
@Schema({ _id: false })
export class ITSupportServiceSchema extends BaseServiceSchema {
  @Prop({ type: String, enum: ['IT Support'], required: true })
  serviceCategory: 'IT Support';

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments?: AttachmentSchema[];
}
```

---

## 🔌 DISEÑO DESACOPLADO (StorageProvider)

**Interfaz mínima**:

- uploadImage({ tenantId, quoteId, file }) -> AttachmentSchema
- deleteAsset({ publicId })

**Implementación**:

- CloudinaryStorageProvider (Release 2)
- S3StorageProvider (plan de salida)

---

## 🎯 ENDPOINTS (MVP - IMPLEMENTADOS)

### Subir imagen

```
POST /quotes/:quoteId/services/it-support/attachments
multipart/form-data { file }

Validaciones:
- allowlist MIME (image/jpeg, image/png, image/webp)
- file.size <= 5MB
- attachments.length < 4

Respuesta:
{
  "provider": "cloudinary",
  "publicId": "quotes/123/img1",
  "secureUrl": "https://res.cloudinary.com/...",
  "mimeType": "image/jpeg",
  "bytes": 245000,
  "originalName": "damage.jpg",
  "createdAt": "2026-01-07T10:00:00Z",
  "expiresAt": "2026-02-06T10:00:00Z"
}
```

### Obtener attachments (para preview)

```
GET /quotes/:quoteId/services/it-support/attachments

Respuesta:
[
  {
    "provider": "cloudinary",
    "publicId": "quotes/123/img1",
    "secureUrl": "https://res.cloudinary.com/...",
    "mimeType": "image/jpeg",
    "bytes": 245000,
    "createdAt": "2026-01-07T10:00:00Z",
    "expiresAt": "2026-02-06T10:00:00Z"
  }
]
```

### Borrar imagen

```
DELETE /quotes/:quoteId/services/it-support/attachments/:publicId

Respuesta: 204 No Content
```

---

## 🗑️ RETENCIÓN Y LIMPIEZA

**DECISIÓN FINAL**: Limpieza al cambiar status (NO Cron)

**Contexto**:

- Quote es un pedido de presupuesto (status = `requested`)
- Las imágenes solo sirven mientras la quote está activa
- Una vez que la quote es `cancelled`, las imágenes no tienen valor
- Quote siempre permanece como registro histórico

**Implementación**:

1. Cuando user cancela quote → `cancelQuoteWithCoordination()` se ejecuta
2. Llama a `AttachmentsCoordinatorService.cleanupAttachmentsOnCancel(quoteId)`
3. Para cada attachment:
   - Borrar imagen de Cloudinary (usando publicId)
   - Vaciar array de attachments en Quote
4. Quote permanece en BD como registro histórico
5. Limpieza inmediata, sin delay, sin cron

**Ventajas**:

- ✅ Limpieza inmediata (sin esperar 24h)
- ✅ Sin cron job que mantener
- ✅ Lógica clara (status = acción)
- ✅ Integrado en flujo existente
- ✅ Costo optimizado (menos imágenes en Cloudinary)

**Nota**: Cuando se implemente Presupuesto Formal (otra sección), se decidirá si guardar o borrar attachments cuando status = `accepted`

---

## 💬 SLACK: PREVIEW Y DESCARGAS

- Cuando Slack muestra preview (unfurl), descarga la imagen una vez
- "Verla en el chat" no vuelve a descargar
- "Abrirla/agrandarla" puede generar descargas adicionales

**El consumo grande viene del bandwidth (views/aperturas), no del upload.**

---

## 📈 CAPACIDAD DEL FREE TIER

Asumimos free tier ≈ 25 créditos mensuales.

**Consumo por quote** (2 imágenes, optimizadas):

- Storage: 0.012 créditos
- Transforms: 0.002 créditos
- Bandwidth: 0.004 créditos
- **Total: 0.018 créditos**

**Capacidad**: 25 / 0.018 ≈ **1388 quotes/mes**

Con margen porque no todas serán IT Support ni tendrán 2 imágenes.

**En tu situación actual: ampliamente suficiente.**

---

## 🛣️ ROADMAP (IMPLEMENTACIÓN COMPLETADA)

### ✅ Completado

- ✅ AttachmentSchema (subdocumento)
- ✅ ITSupportServiceSchema extendido con attachments array
- ✅ AttachmentsService (CRUD raíz)
- ✅ AttachmentsCoordinatorService (coordinación Storage + Attachments)
- ✅ AttachmentsController (POST upload, GET preview, DELETE remove)
- ✅ Validaciones (MIME, tamaño, cantidad)
- ✅ Limpieza al cambiar status (cancelQuoteWithCoordination)
- ✅ Documentación en .augment-config.md
- ✅ Documentación en RELEASE2_ANALYSIS.md

### 📋 Próximos pasos

- [ ] Tests unitarios (AttachmentsService, AttachmentsCoordinatorService)
- [ ] Tests de integración (endpoints)
- [ ] Integración Slack (enviar imágenes en notificaciones)
- [ ] Presupuesto Formal (decidir qué hacer con attachments cuando status = accepted)

---

## 🚀 PLAN DE SALIDA (EXIT STRATEGY)

Si: entra video, muchos tenants, free tier queda chico, Cloudinary cambia costos

**Migrar a S3-compatible**:

- mismo AttachmentSchema (o mínimo cambio)
- provider: 's3'
- publicId → objectKey
- secureUrl → signedUrl o endpoint proxy
- swap de implementación dentro del StorageProvider

**Sin tocar Quotes ni el modelo de servicios.**

---

## 🏗️ ARQUITECTURA IMPLEMENTADA

### Servicios

**AttachmentsService** (Raíz - CRUD)

- `addAttachment(quoteId, attachmentData)` - agregar a Quote
- `removeAttachment(quoteId, publicId)` - remover de Quote
- `getAttachments(quoteId)` - obtener para preview
- Solo inyecta: `@Inject('QUOTE_MODEL')`

**AttachmentsCoordinatorService** (Transversal - Coordinación)

- `uploadAndPersist(quoteId, file)` - validar → subir → persistir
- `cleanupAttachmentsOnCancel(quoteId)` - borrar de Cloudinary + vaciar Quote
- Inyecta: `StorageService` + `AttachmentsService`

**AttachmentsController** (HTTP)

- `POST /quotes/:quoteId/services/it-support/attachments` - subir
- `GET /quotes/:quoteId/services/it-support/attachments` - preview
- `DELETE /quotes/:quoteId/services/it-support/attachments/:publicId` - borrar

### Estructura de Datos

Attachments son **subdocumentos** dentro de Quote:

```
Quote
├── services: [
│   {
│       serviceCategory: "IT Support",
│       attachments: [
│           {
│               provider: "cloudinary",
│               publicId: "quotes/123/img1",
│               secureUrl: "https://res.cloudinary.com/...",
│               mimeType: "image/jpeg",
│               bytes: 245000,
│               createdAt: Date,
│               expiresAt: Date
│           }
│       ]
│   }
│]
```

**Importante**:

- ✅ Attachments se guardan DENTRO de Quote (no colección aparte)
- ✅ Se guarda METADATA (no la imagen)
- ✅ La imagen está en Cloudinary
- ✅ Quote permanece como registro histórico (solo se vacía attachments array)

### Flujo de Limpieza

```
User cancela quote
  ↓
cancelQuoteWithCoordination() se ejecuta
  ↓
cleanupAttachmentsOnCancel() (no-blocking)
  ├─ Obtener todos los attachments
  ├─ Para cada uno:
  │  ├─ Borrar de Cloudinary (usando publicId)
  │  └─ Remover de Quote (vaciar array)
  └─ Log de éxito
  ↓
Cambiar status a Cancelled
  ↓
Notificar Slack
  ↓
Registrar History
  ↓
Quote permanece en BD como registro histórico
```

---

## ✅ CONCLUSIÓN FINAL

- Plan realista y contextualizado a tu arquitectura (Quotes + services discriminados + multitenant)
- Cloudinary es la mejor opción para Release 2 (MVP)
- Límites definidos evitan sorpresas
- Storage desacoplado garantiza que el diseño no te encierra
- Limpieza al cambiar status es más eficiente que cron
- Quote siempre permanece como historial (solo se limpian imágenes)
