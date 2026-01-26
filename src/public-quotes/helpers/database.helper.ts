import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DatabaseHelper {
  private readonly logger = new Logger(DatabaseHelper.name);
  private dbName: string;

  constructor() {
    this.dbName = this.detectDatabaseName();
  }

  /**
   * Detectar el nombre de la BD superior según el ambiente
   * - Si URI contiene 'firstplug-dev' → usar 'firstPlug' (desarrollo)
   * - Si no → usar 'main' (producción)
   */
  private detectDatabaseName(): string {
    const mongoUri = process.env.DB_CONNECTION_STRING || '';
    
    if (mongoUri.includes('firstplug-dev')) {
      this.logger.log('Using development database: firstPlug');
      return 'firstPlug';
    }
    
    this.logger.log('Using production database: main');
    return 'main';
  }

  /**
   * Obtener el nombre de la BD superior
   */
  getDatabaseName(): string {
    return this.dbName;
  }

  /**
   * Obtener el nombre de la colección de quotes
   */
  getCollectionName(): string {
    return 'quotes';
  }
}

