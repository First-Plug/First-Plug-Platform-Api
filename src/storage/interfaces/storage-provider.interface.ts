/**
 * Interfaz agnóstica para proveedores de storage
 * Permite cambiar entre Cloudinary, S3, etc. sin tocar el código que lo usa
 */
export interface UploadOptions {
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'auto';
  transformation?: any;
}

export interface UploadResult {
  provider: 'cloudinary' | 's3' | string;
  publicId: string;
  secureUrl: string;
  mimeType: string;
  bytes: number;
  originalName?: string;
  resourceType?: string;
}

export interface DeleteResult {
  success: boolean;
  publicId: string;
}

// Tipo para archivo multipart
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StorageProvider {
  /**
   * Subir un archivo
   */
  upload(file: FileUpload, options: UploadOptions): Promise<UploadResult>;

  /**
   * Borrar un archivo por publicId
   */
  delete(publicId: string): Promise<DeleteResult>;

  /**
   * Obtener URL pública de un recurso
   */
  getUrl(publicId: string, options?: any): string;

  /**
   * Obtener URL firmada (para acceso privado)
   */
  getSignedUrl(publicId: string, expiresIn?: number): Promise<string>;
}
