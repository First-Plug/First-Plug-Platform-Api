import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
  DeleteResult,
  FileUpload,
} from '../interfaces/storage-provider.interface';

/**
 * Implementación de StorageProvider para Cloudinary
 * Maneja upload, delete y URLs de recursos
 */
@Injectable()
export class CloudinaryProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(private configService: ConfigService) {
    // Configurar Cloudinary con variables de entorno
    // Intentar primero con ConfigService, si no funciona usar process.env directamente
    let cloudName = this.configService.get('cloudinary.cloudName');
    let apiKey = this.configService.get('cloudinary.apiKey');
    let apiSecret = this.configService.get('cloudinary.apiSecret');

    // Fallback a process.env si ConfigService no retorna valores
    if (!cloudName) {
      cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    }
    if (!apiKey) {
      apiKey = process.env.CLOUDINARY_API_KEY;
    }
    if (!apiSecret) {
      apiSecret = process.env.CLOUDINARY_API_SECRET;
    }

    this.logger.log(
      `Cloudinary config - Cloud: ${cloudName}, Key: ${apiKey ? 'set' : 'missing'}, Secret: ${apiSecret ? 'set' : 'missing'}`,
    );

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.logger.log(
      `Cloudinary configured with: ${JSON.stringify({ cloud_name: cloudName, api_key: apiKey ? '***' : 'missing', api_secret: apiSecret ? '***' : 'missing' })}`,
    );
  }

  /**
   * Subir archivo a Cloudinary
   * Soporta transformaciones automáticas (resize, compress, etc.)
   */
  async upload(
    file: FileUpload,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const uploadOptions: any = {
        resource_type: options.resourceType || 'auto',
        public_id: options.publicId,
        folder: options.folder || 'firstplug/uploads',
        // Transformaciones automáticas para imágenes
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: 'limit',
            quality: 'auto',
            fetch_format: 'auto',
          },
        ],
      };

      // Si hay transformaciones personalizadas, usarlas
      if (options.transformation) {
        uploadOptions.transformation = options.transformation;
      }

      // Usar upload_stream con callback
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(new Error('No result from Cloudinary upload'));
              return;
            }

            resolve({
              provider: 'cloudinary',
              publicId: result.public_id,
              secureUrl: result.secure_url,
              mimeType: file.mimetype,
              bytes: file.size,
              originalName: file.originalname,
              resourceType: result.resource_type,
            });
          },
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      this.logger.error(`Error uploading to Cloudinary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Borrar archivo de Cloudinary por publicId
   */
  async delete(publicId: string): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === 'ok',
        publicId,
      };
    } catch (error) {
      this.logger.error(`Error deleting from Cloudinary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener URL pública de un recurso
   */
  getUrl(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      fetch_format: 'auto',
      quality: 'auto',
      ...options,
    });
  }

  /**
   * Obtener URL firmada (para acceso privado)
   * Cloudinary soporta signed URLs con expiración
   */
  async getSignedUrl(
    publicId: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!apiSecret) {
        throw new Error('CLOUDINARY_API_SECRET is not configured');
      }

      const timestamp = Math.floor(Date.now() / 1000) + expiresIn;
      const signature = cloudinary.utils.api_sign_request(
        { public_id: publicId, timestamp },
        apiSecret,
      );

      return cloudinary.url(publicId, {
        secure: true,
        sign_url: true,
        type: 'authenticated',
        timestamp,
        signature,
      });
    } catch (error) {
      this.logger.error(`Error generating signed URL: ${error.message}`);
      throw error;
    }
  }
}
