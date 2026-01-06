# 🚀 RELEASE 2: IT SUPPORT ATTACHMENTS - PLAN ÚNICO

## ⚡ RESUMEN EJECUTIVO

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Agregar adjuntos (imágenes) a IT Support dentro de Quotes |
| **Solución** | Cloudinary (MVP) con plan de salida a S3 |
| **Costo** | $0 mientras use free tier; $84+/año si crece 10x |
| **Tiempo** | 7-10 días |
| **Cambios** | Agregar AttachmentSchema a ITSupportServiceSchema |

---

## 🏗️ CONTEXTO DEL PROYECTO

Tu arquitectura actual:
- ✅ Quote.services: array discriminado por `serviceCategory`
- ✅ ITSupportServiceSchema: ya existe, extiende BaseServiceSchema
- ✅ Multitenant: cada tenant tiene su DB, Quote incluye tenantId/tenantName
- ✅ Slack: integrado con QuotesCoordinatorService + CreateQuoteMessageToSlack
- ✅ History: registra cambios en Quote (creación, cancelación)

**Implicación**: No cambias arquitectura. Solo extender ITSupportServiceSchema.

---

## 📋 DECISIONES CERRADAS (SCOPE)

✅ **Solo imágenes en Release 2** (video cambia todo: bandwidth, UX, límites)
✅ **5 MB por imagen** (pantallazos + fotos hardware)
✅ **4 imágenes máximo** (cubre 99% de casos)
✅ **30 días retención** (desde creación, MVP simple)
✅ **Cloudinary MVP** (rápido + barato)
✅ **Plan de salida a S3** (escalable después)

---

## 🏆 CLOUDINARY: ANÁLISIS HONESTO

### ✅ Ventajas Reales
- **Setup rápido**: 5 minutos crear cuenta
- **Compresión automática**: 40-60% sin configuración
- **CDN incluido**: entrega rápida global
- **Costo $0**: mientras use free tier (5% del límite)
- **Menos código**: vs S3 (no necesitas signed URLs, lifecycle policies, etc.)

### ⚠️ Limitaciones Importantes
- **Slack preview NO es automático**: depende de URLs públicas; si usás URLs firmadas, puede fallar
- **Auto-delete NO es nativo**: necesitas scheduled job (cron) que borre por expiresAt
- **Sin antivirus MVP**: solo validación MIME + extensión + size
- **Créditos pueden cambiar**: no es garantía técnica de "siempre gratis", pero muy estable

### 💰 Costos Realistas

```
Escenario base: 100 IT Support/mes, 2 imágenes por request
├─ 400 MB/mes almacenamiento
├─ 200 transformaciones/mes
└─ 700 MB/mes bandwidth
└─ Total: 1.3 GB/mes (5% del límite de 25 GB)

Costo:
├─ Año 1: $0 (free tier)
├─ Año 2: $0 (si no crece)
└─ Año 3: $0 (si no crece)
└─ Si crece 10x: $84-120/año
```

---

## 🔧 CAMBIOS DE SCHEMA

### 1. Crear AttachmentSchema (nuevo)

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
  mimeType: string; // image/jpeg, image/png, image/webp

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

### 2. Extender ITSupportServiceSchema

```typescript
import { AttachmentSchema } from './attachment.schema';

@Schema({ _id: false })
export class ITSupportServiceSchema extends BaseServiceSchema {
  @Prop({ type: String, enum: ['IT Support'], required: true })
  serviceCategory: 'IT Support';

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments?: AttachmentSchema[];
}
```

---

## 🎯 ENDPOINTS

### Upload imagen a IT Support

```
POST /quotes/:quoteId/services/it-support/attachments
Body: multipart/form-data { file }

Validaciones:
- mimeType: image/jpeg, image/png, image/webp
- file.size <= 5MB
- attachments.length < 4
```

### Borrar imagen (opcional)

```
DELETE /quotes/:quoteId/services/it-support/attachments/:publicId
```

---

## 🗑️ RETENCIÓN Y LIMPIEZA

Cron diario que:
1. Busca attachments con expiresAt < now
2. Llama cloudinary.destroy(publicId)
3. Pull del array attachments

Funciona con multitenant porque cada DB de tenant puede correr el cron.

---

## 📊 ROADMAP (7-10 DÍAS)

- **Día 1**: Schemas + config Cloudinary
- **Días 2-4**: Upload controller + service + validaciones
- **Días 5-6**: Slack + delete endpoint
- **Días 7-8**: Cron cleanup
- **Días 9-10**: QA + deploy

---

## 🚀 PLAN DE SALIDA (EXIT STRATEGY)

Si sucede cualquiera:
- Quieren video
- Muchos tenants activos
- Free tier no alcanza

➡️ Migración a S3-compatible:
- Mantener AttachmentSchema igual, cambiar provider: 's3'
- publicId → objectKey
- secureUrl → signedUrl o endpoint proxy
- Cambiar implementación detrás de StorageAdapter

---

## ✅ CONCLUSIÓN

Plan es **sólido y contextualizado** a tu arquitectura.

**Próximo paso**: Confirmar decisiones cerradas o ajustar si es necesario.

Con eso: código NestJS + Cron + Slack payload listos para implementar.

