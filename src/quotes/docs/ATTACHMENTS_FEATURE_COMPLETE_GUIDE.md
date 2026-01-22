# 📎 Attachments Feature - Guía Completa

## 🎯 Visión General

Sistema modular y escalable para manejar adjuntos (imágenes) en servicios IT Support. Diseñado para permitir fácil extensión a otros módulos sin cambios en la arquitectura core.

## 🏗️ Arquitectura

### Capas

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Layer (Controller)                                 │
│ - POST /quotes (multipart/form-data)                   │
│ - POST /quotes/:id/services/it-support/attachments     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Coordinator Layer (Business Logic)                      │
│ - QuotesCoordinatorService (procesa attachments)       │
│ - AttachmentsCoordinatorService (valida + sube)        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Service Layer (Domain Logic)                            │
│ - QuotesService (CRUD quotes)                          │
│ - AttachmentsService (CRUD attachments en Quote)       │
│ - StorageService (abstracción de providers)            │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Provider Layer (External Services)                      │
│ - CloudinaryProvider (upload/delete)                   │
│ - S3Provider (plan futuro)                             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Data Layer (MongoDB)                                    │
│ - Quote (contiene attachments subdocumento)            │
│ - AttachmentSchema (metadata del archivo)              │
└─────────────────────────────────────────────────────────┘
```

## 📦 Componentes Clave

### 1. **StorageService** (Desacoplado)

- Interfaz agnóstica de provider
- Soporta Cloudinary (MVP) y S3 (futuro)
- Métodos: `upload()`, `delete()`
- **Ubicación:** `src/storage/`

### 2. **AttachmentsCoordinatorService**

- Valida archivos (MIME, tamaño)
- Orquesta upload a Cloudinary
- Persiste metadata en Quote
- Maneja cleanup en errores
- **Ubicación:** `src/quotes/attachments-coordinator.service.ts`

### 3. **AttachmentsService**

- CRUD de attachments en Quote
- Busca IT Support service
- Agrega/remueve attachments
- **Ubicación:** `src/quotes/attachments.service.ts`

### 4. **QuotesCoordinatorService**

- Procesa attachments antes de crear quote
- Mapea archivos a servicios IT Support
- Notifica a Slack con imágenes
- **Ubicación:** `src/quotes/quotes-coordinator.service.ts`

## 🔄 Flujos

### Crear Quote con Attachments

```
1. Frontend envía multipart/form-data
   - services: JSON array
   - products: JSON array
   - files: File[] (imágenes)

2. QuotesController recibe request
   - FilesInterceptor procesa archivos
   - Valida con Zod

3. QuotesCoordinatorService.createQuoteWithCoordination()
   - Llama processAttachmentsForServices()
   - Valida cada archivo
   - Sube a Cloudinary
   - Mapea attachments a IT Support services

4. QuotesService.create()
   - Guarda quote con attachments en MongoDB

5. SlackService.notifyQuoteCreated()
   - Envía mensaje con imágenes
```

### Upload Individual (Preview)

```
1. Frontend: POST /quotes/:id/services/it-support/attachments
   - FormData con 1 archivo

2. AttachmentsController.uploadImage()
   - FileInterceptor procesa archivo

3. AttachmentsCoordinatorService.uploadAndPersist()
   - Valida
   - Sube a Cloudinary
   - Persiste en Quote
   - Retorna attachment

4. Frontend: muestra preview
```

## 📋 Validaciones

- **MIME types:** image/jpeg, image/png, image/webp
- **Tamaño máximo:** 5MB por archivo
- **Cantidad máxima:** 10 archivos por request
- **Expiración:** 30 días desde creación

## 🔌 Extensibilidad

### Para agregar attachments a otro módulo:

1. **Crear AttachmentSchema en el módulo**

   ```typescript
   @Schema({ _id: false })
   export class AttachmentSchema { ... }
   ```

2. **Extender el servicio del módulo**

   ```typescript
   async addAttachment(id: string, attachment: any) {
     // Lógica similar a AttachmentsService
   }
   ```

3. **Inyectar StorageService**

   ```typescript
   constructor(private storageService: StorageService) {}
   ```

4. **Usar AttachmentsCoordinatorService o crear uno similar**
   - Reutilizar validaciones
   - Reutilizar upload logic

### Ejemplo: Agregar attachments a Shipments

```typescript
// 1. Extender ShipmentSchema
@Schema()
export class ShipmentSchema {
  attachments?: AttachmentSchema[];
}

// 2. Crear ShipmentAttachmentsService
@Injectable()
export class ShipmentAttachmentsService {
  constructor(
    private storageService: StorageService,
    private shipmentRepository: ShipmentRepository
  ) {}

  async addAttachment(shipmentId: string, file: any) {
    // Validar, subir, persistir
  }
}

// 3. Usar en controller
@Post(':id/attachments')
async uploadAttachment(@Param('id') id: string, @UploadedFile() file: any) {
  return this.shipmentAttachments.addAttachment(id, file);
}
```

## 📚 Documentación Relacionada

- **ATTACHMENTS_README.md** - Índice y quick start
- **PAYLOAD_EXAMPLES_MULTI_CATEGORY.md** - Payloads de ejemplo
- **ATTACHMENTS_ARCHITECTURE_IMPROVEMENTS.md** - Mejoras para escalabilidad

## ✅ Testing

```bash
# Crear quote con attachments
POST /quotes
Content-Type: multipart/form-data
- services: [IT Support service]
- products: []
- files: [image1.jpg, image2.png]

# Upload individual
POST /quotes/:id/services/it-support/attachments
Content-Type: multipart/form-data
- file: image.jpg
```

## 🚀 Próximos Pasos

- [ ] Agregar attachments a Shipments
- [ ] Agregar attachments a Orders
- [ ] Implementar S3Provider
- [ ] Agregar compresión de imágenes
- [ ] Agregar watermark
