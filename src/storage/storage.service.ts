import { Injectable, Inject } from '@nestjs/common';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
  DeleteResult,
  FileUpload,
} from './interfaces/storage-provider.interface';

/**
 * Servicio de Storage agnóstico
 * Usa el provider inyectado (Cloudinary, S3, etc.)
 * Permite cambiar de provider sin tocar el código que lo usa
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly provider: StorageProvider,
  ) {}

  /**
   * Subir archivo
   * @param file - archivo multipart
   * @param options - opciones de upload (folder, publicId, transformaciones)
   * @returns UploadResult con publicId, secureUrl, etc.
   */
  async upload(
    file: FileUpload,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    return this.provider.upload(file, options);
  }

  /**
   * Borrar archivo
   * @param publicId - ID público del recurso en el provider
   * @returns DeleteResult con status de éxito
   */
  async delete(publicId: string): Promise<DeleteResult> {
    return this.provider.delete(publicId);
  }

  /**
   * Obtener URL pública
   * @param publicId - ID público del recurso
   * @param options - opciones de transformación (resize, crop, etc.)
   * @returns URL pública del recurso
   */
  getUrl(publicId: string, options?: any): string {
    return this.provider.getUrl(publicId, options);
  }

  /**
   * Obtener URL firmada (acceso privado)
   * @param publicId - ID público del recurso
   * @param expiresIn - segundos hasta que expire la URL
   * @returns URL firmada con expiración
   */
  async getSignedUrl(publicId: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(publicId, expiresIn);
  }
}
