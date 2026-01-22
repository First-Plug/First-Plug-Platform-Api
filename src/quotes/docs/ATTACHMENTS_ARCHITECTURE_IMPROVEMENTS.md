# 🔧 Mejoras Arquitectónicas para Attachments

## Problema Actual

La feature de attachments funciona bien para IT Support, pero tiene puntos de fricción para escalar a otros módulos (Shipments, Orders, etc.).

## Mejoras Recomendadas

### 1. Centralizar Configuración

**Crear:** `src/attachments/config/attachment.config.ts`

```typescript
export const ATTACHMENT_CONFIG = {
  ALLOWED_MIMES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  EXPIRATION_DAYS: 30,
  MAX_FILES_PER_REQUEST: 10,
  STORAGE_FOLDER_PREFIX: 'attachments', // attachments/quotes, attachments/shipments
};
```

**Beneficio:** Cambiar límites en un solo lugar

### 2. Crear FileValidationService Genérico

**Crear:** `src/attachments/services/file-validation.service.ts`

```typescript
@Injectable()
export class FileValidationService {
  validateFile(file: any, config?: Partial<AttachmentConfig>): void {
    const cfg = { ...ATTACHMENT_CONFIG, ...config };
    // Validar MIME, tamaño, etc.
  }

  validateFiles(files: any[], config?: Partial<AttachmentConfig>): void {
    // Validar múltiples archivos
  }
}
```

**Beneficio:** Reutilizar en todos los módulos

### 3. Crear Interfaz IAttachable

**Crear:** `src/attachments/interfaces/attachable.interface.ts`

```typescript
export interface IAttachable {
  _id: string;
  attachments?: AttachmentSchema[];
}

export interface IAttachableService {
  addAttachment(id: string, attachment: any): Promise<any>;
  removeAttachment(id: string, publicId: string): Promise<void>;
  getAttachments(id: string): Promise<AttachmentSchema[]>;
}
```

**Beneficio:** Contrato claro para servicios que manejan attachments

### 4. Crear AttachmentsGenericService

**Crear:** `src/attachments/services/attachments-generic.service.ts`

```typescript
@Injectable()
export class AttachmentsGenericService {
  constructor(
    private storageService: StorageService,
    private fileValidation: FileValidationService,
  ) {}

  async uploadAndPersist<T extends IAttachable>(
    repository: any, // GenericRepository<T>
    id: string,
    file: any,
    options: {
      folder: string;
      config?: Partial<AttachmentConfig>;
    }
  ): Promise<AttachmentSchema> {
    // Validar
    this.fileValidation.validateFile(file, options.config);

    // Subir
    const uploadResult = await this.storageService.upload(file, {
      folder: options.folder,
      resourceType: 'image',
    });

    // Persistir
    const attachment = this.createAttachmentObject(uploadResult);
    await repository.addAttachment(id, attachment);

    return attachment;
  }

  async deleteAttachment<T extends IAttachable>(
    repository: any,
    id: string,
    publicId: string,
  ): Promise<void> {
    await repository.removeAttachment(id, publicId);
    await this.storageService.delete(publicId);
  }
}
```

**Beneficio:** Lógica de attachments reutilizable para cualquier módulo

### 5. Crear Helper Genérico para Slack

**Crear:** `src/attachments/helpers/slack-attachments.helper.ts`

```typescript
export class SlackAttachmentsHelper {
  static createAttachmentBlocks(attachments: AttachmentSchema[]): any[] {
    if (!attachments?.length) return [];

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📎 Attachments (${attachments.length})*`,
        },
      },
      ...attachments.map(att => ({
        type: 'image',
        image_url: att.secureUrl,
        alt_text: att.originalName || 'Attachment',
      })),
    ];
  }
}
```

**Beneficio:** Reutilizar en Quote, Shipment, Order, etc.

## Implementación Gradual

### Fase 1 (Ahora)
- ✅ Crear `ATTACHMENT_CONFIG`
- ✅ Crear `FileValidationService`
- ✅ Refactorizar `AttachmentsCoordinatorService` para usarlos

### Fase 2 (Próximo)
- Crear `AttachmentsGenericService`
- Crear `IAttachable` interface
- Refactorizar `AttachmentsService` para implementar interfaz

### Fase 3 (Cuando agregues a Shipments)
- Usar `AttachmentsGenericService` en ShipmentAttachmentsService
- Usar `SlackAttachmentsHelper` en Slack messages

## Estructura Final

```
src/attachments/
├── config/
│   └── attachment.config.ts
├── interfaces/
│   ├── attachable.interface.ts
│   └── attachment.interface.ts
├── services/
│   ├── file-validation.service.ts
│   ├── attachments-generic.service.ts
│   └── attachments.service.ts (específico de Quote)
├── helpers/
│   └── slack-attachments.helper.ts
└── attachments.module.ts
```

## Ventajas

- ✅ Reutilizable en cualquier módulo
- ✅ Configuración centralizada
- ✅ Validaciones consistentes
- ✅ Menos código duplicado
- ✅ Fácil de testear
- ✅ Escalable a nuevos providers

