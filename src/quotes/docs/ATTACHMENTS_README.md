# 📎 Attachments Feature - README

## 🎯 ¿Qué es?

Sistema para subir y mostrar imágenes en servicios IT Support. Las imágenes se guardan en Cloudinary y se muestran en Slack.

## 📖 Documentación

**Lee esto primero:**

1. **ATTACHMENTS_FEATURE_COMPLETE_GUIDE.md** ← EMPIEZA AQUÍ
   - Visión general
   - Arquitectura
   - Componentes clave
   - Flujos

**Para entender cómo escalar:**

2. **ATTACHMENTS_ARCHITECTURE_IMPROVEMENTS.md**
   - Problemas actuales
   - Mejoras recomendadas
   - Cómo agregar a otros módulos

**Referencia técnica:**

3. **PAYLOAD_EXAMPLES_MULTI_CATEGORY.md**
   - Payloads JSON de ejemplo

**Plan de Refactoring (Mejoras Futuras):**

- **REFACTORING_SUMMARY.md** - Resumen ejecutivo del plan
- **REFACTORING_PLAN_SAFE.md** - Plan completo de 6 fases
- **REFACTORING_PHASE1_INSTRUCTIONS.md** - Instrucciones paso a paso

**Documentación Legacy (solo referencia):**

- **RELEASE2_ANALYSIS.md** - Análisis original de la feature (en raíz del proyecto)

## 🚀 Quick Start

### Crear Quote con Imágenes (Postman)

```
POST http://localhost:3001/quotes
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}

Body:
- services: [IT Support JSON]
- products: []
- files: [image1.jpg, image2.png]
```

### Crear Quote con Imágenes (Frontend)

```javascript
const formData = new FormData();
formData.append('services', JSON.stringify([...services]));
formData.append('products', JSON.stringify([]));
formData.append('files', fileInput.files[0]);

fetch('/quotes', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

## ✅ Validaciones

- **Formatos:** JPEG, PNG, WebP
- **Tamaño:** máx 5MB por archivo
- **Cantidad:** máx 10 archivos
- **Expiración:** 30 días

## 🏗️ Arquitectura

```
Controller → Coordinator → Service → Storage → Cloudinary
                                   ↓
                              MongoDB
```

**Desacoplado:** Cambiar de Cloudinary a S3 es trivial

## 🔌 Extensibilidad

Para agregar attachments a Shipments/Orders:

1. Extender schema con `attachments?: AttachmentSchema[]`
2. Crear servicio similar a `AttachmentsService`
3. Inyectar `StorageService`
4. Usar `AttachmentsCoordinatorService` o crear uno similar

Ver **ATTACHMENTS_ARCHITECTURE_IMPROVEMENTS.md** para detalles.

## 📁 Archivos Clave

```
src/quotes/
├── attachments.controller.ts
├── attachments.service.ts
├── attachments-coordinator.service.ts
├── quotes-coordinator.service.ts
├── schemas/attachment.schema.ts
├── helpers/create-quote-message-to-slack.ts
└── docs/
    ├── ATTACHMENTS_README.md (este archivo)
    ├── ATTACHMENTS_FEATURE_COMPLETE_GUIDE.md
    └── ATTACHMENTS_ARCHITECTURE_IMPROVEMENTS.md

src/storage/
├── storage.service.ts
├── storage.module.ts
├── interfaces/storage-provider.interface.ts
└── providers/cloudinary.provider.ts
```

## ❓ Preguntas Frecuentes

**¿Dónde se guardan las imágenes?**

- Cloudinary (cloud storage)

**¿Dónde se guarda la metadata?**

- MongoDB (en Quote.services[].attachments)

**¿Puedo cambiar a S3?**

- Sí, solo cambiar el provider en StorageService

**¿Puedo agregar attachments a Shipments?**

- Sí, ver ATTACHMENTS_ARCHITECTURE_IMPROVEMENTS.md

**¿Qué pasa si cancelo una quote?**

- Las imágenes se borran de Cloudinary automáticamente
