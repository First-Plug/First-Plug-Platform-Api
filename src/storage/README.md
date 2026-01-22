# Storage Module - Desacoplado y Modular

## Descripción

Módulo agnóstico para manejar storage de archivos. Actualmente usa **Cloudinary** como provider MVP, pero está diseñado para cambiar a S3, R2, B2, etc. sin tocar el código que lo usa.

## Estructura

```
src/storage/
├── interfaces/
│   └── storage-provider.interface.ts    # Interfaz agnóstica
├── providers/
│   └── cloudinary.provider.ts           # Implementación Cloudinary
├── storage.service.ts                   # Servicio que abstrae el provider
├── storage.module.ts                    # Módulo NestJS
├── index.ts                             # Exportaciones
└── README.md                            # Este archivo
```

## Cómo Usar

### 1. Importar el módulo en tu módulo

```typescript
import { StorageModule } from 'src/storage';

@Module({
  imports: [StorageModule],
  // ...
})
export class QuotesModule {}
```

### 2. Inyectar StorageService en tu servicio

```typescript
import { StorageService } from 'src/storage';

@Injectable()
export class QuotesCoordinatorService {
  constructor(private storageService: StorageService) {}

  async processAttachmentsForServices(
    createQuoteDto: CreateQuoteDto,
    files: Express.Multer.File[],
    tenantId: Types.ObjectId,
  ) {
    // Validar archivos
    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type');
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException('File too large');
      }
    }

    // Subir a Cloudinary
    const attachments = [];
    for (const file of files) {
      const uploadResult = await this.storageService.upload(file, {
        folder: `quotes/${tenantId}/it-support`,
        resourceType: 'image',
      });

      attachments.push({
        provider: uploadResult.provider,
        publicId: uploadResult.publicId,
        secureUrl: uploadResult.secureUrl,
        mimeType: uploadResult.mimeType,
        bytes: uploadResult.bytes,
        originalName: uploadResult.originalName,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    // Agregar attachments a servicios IT Support
    if (createQuoteDto.services) {
      for (const service of createQuoteDto.services) {
        if (service.serviceCategory === 'IT Support') {
          (service as any).attachments = attachments;
        }
      }
    }
  }
}
```

## API

### `upload(file, options)`

Subir un archivo.

**Parámetros**:

- `file`: Express.Multer.File
- `options`: UploadOptions (opcional)
  - `folder`: carpeta en el provider
  - `publicId`: ID público personalizado
  - `resourceType`: 'image' | 'video' | 'auto'
  - `transformation`: transformaciones personalizadas

**Retorna**: UploadResult

```typescript
{
  provider: 'cloudinary',
  publicId: string,
  secureUrl: string,
  mimeType: string,
  bytes: number,
  originalName?: string,
  resourceType?: string,
}
```

### `delete(publicId)`

Borrar un archivo.

**Parámetros**:

- `publicId`: ID público del recurso

**Retorna**: DeleteResult

```typescript
{
  success: boolean,
  publicId: string,
}
```

### `getUrl(publicId, options)`

Obtener URL pública de un recurso.

**Parámetros**:

- `publicId`: ID público del recurso
- `options`: opciones de transformación (opcional)

**Retorna**: string (URL pública)

### `getSignedUrl(publicId, expiresIn)`

Obtener URL firmada (acceso privado con expiración).

**Parámetros**:

- `publicId`: ID público del recurso
- `expiresIn`: segundos hasta expiración (default: 3600)

**Retorna**: Promise<string> (URL firmada)

## Variables de Entorno

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Plan de Salida (Migración a S3)

Para cambiar a S3:

1. Crear `src/storage/providers/s3.provider.ts` implementando `StorageProvider`
2. Actualizar `storage.module.ts`:
   ```typescript
   {
     provide: 'STORAGE_PROVIDER',
     useClass: S3Provider, // cambiar de CloudinaryProvider
   }
   ```
3. Listo. El resto del código no cambia.

## Notas

- El módulo es agnóstico: no depende de Cloudinary específicamente
- Fácil de testear: inyectar un mock de StorageProvider
- Escalable: agregar nuevos providers sin tocar código existente
