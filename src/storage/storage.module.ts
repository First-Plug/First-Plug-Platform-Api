import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { CloudinaryProvider } from './providers/cloudinary.provider';

/**
 * Módulo de Storage desacoplado
 * Proporciona StorageService que usa CloudinaryProvider (MVP)
 * Fácil de cambiar a S3Provider, etc. sin tocar el resto del código
 *
 * Uso:
 * 1. Importar en el módulo que lo necesite: imports: [StorageModule]
 * 2. Inyectar en el servicio: constructor(private storageService: StorageService)
 * 3. Usar: await this.storageService.upload(file, { folder: 'quotes' })
 */
@Module({
  imports: [ConfigModule],
  providers: [
    CloudinaryProvider,
    StorageService,
    {
      provide: 'STORAGE_PROVIDER',
      useExisting: CloudinaryProvider,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
