#!/usr/bin/env ts-node

/**
 * Script de migración: Nombres de países → Códigos de país
 *
 * Migra por tenant para mayor seguridad y control.
 * Convierte nombres como "Argentina" → "AR" en todas las colecciones.
 */

import { MongoClient, Db } from 'mongodb';
import { countryCodes } from '../shipments/helpers/countryCodes';

// Configuración
// para que funcione bien tengo que pegar lo que tengo en el .env
// const MONGO_URI = process.env.MONGO_URI;

// Mapeo de nombres → códigos (usando el archivo existente)
// NOTA: Our office y FP warehouse NO se migran, se mantienen como texto
const COUNTRY_MAPPING: Record<string, string> = {
  ...countryCodes,
};

// Estadísticas de migración
interface MigrationStats {
  tenant: string;
  collections: {
    [collectionName: string]: {
      totalDocuments: number;
      migratedDocuments: number;
      fieldsUpdated: number;
    };
  };
  errors: string[];
}

class CountryMigrator {
  private client: MongoClient;
  private mainDb: Db;
  private stats: MigrationStats[] = [];

  // constructor() {
  //   this.client = new MongoClient(MONGO_URI);
  // }

  async connect() {
    await this.client.connect();
    this.mainDb = this.client.db('firstPlug');
    console.log('✅ Conectado a MongoDB');
  }

  async disconnect() {
    await this.client.close();
    console.log('✅ Desconectado de MongoDB');
  }

  /**
   * Convierte un nombre de país a código
   * EXCLUYE ubicaciones especiales que deben mantenerse como texto
   */
  private convertCountryNameToCode(countryName: string): string | null {
    if (!countryName || typeof countryName !== 'string') {
      return null;
    }

    const trimmed = countryName.trim();

    // NO migrar ubicaciones especiales - mantenerlas como texto
    if (trimmed === 'Our office' || trimmed === 'FP warehouse') {
      return null; // No migrar
    }

    // Si ya es un código válido, devolverlo
    if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Buscar en el mapeo (excluye Our office y FP warehouse)
    return COUNTRY_MAPPING[trimmed] || null;
  }

  /**
   * Migra recursivamente campos country en un objeto
   */
  private migrateCountryFields(obj: any): {
    modified: boolean;
    fieldsUpdated: number;
  } {
    let modified = false;
    let fieldsUpdated = 0;

    if (!obj || typeof obj !== 'object') {
      return { modified, fieldsUpdated };
    }

    for (const key in obj) {
      if (key === 'country' && typeof obj[key] === 'string') {
        const newCode = this.convertCountryNameToCode(obj[key]);
        if (newCode && newCode !== obj[key]) {
          console.log(`    🔄 ${key}: "${obj[key]}" → "${newCode}"`);
          obj[key] = newCode;
          modified = true;
          fieldsUpdated++;
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursión para objetos anidados
        const result = this.migrateCountryFields(obj[key]);
        if (result.modified) {
          modified = true;
          fieldsUpdated += result.fieldsUpdated;
        }
      }
    }

    return { modified, fieldsUpdated };
  }

  /**
   * Migra una colección específica
   */
  private async migrateCollection(
    db: Db,
    collectionName: string,
  ): Promise<{
    totalDocuments: number;
    migratedDocuments: number;
    fieldsUpdated: number;
  }> {
    console.log(`  📂 Migrando colección: ${collectionName}`);

    const collection = db.collection(collectionName);
    const totalDocuments = await collection.countDocuments();

    if (totalDocuments === 0) {
      console.log(`    ℹ️  Colección vacía, saltando...`);
      return { totalDocuments: 0, migratedDocuments: 0, fieldsUpdated: 0 };
    }

    console.log(`    📊 Total documentos: ${totalDocuments}`);

    let migratedDocuments = 0;
    let totalFieldsUpdated = 0;

    // Procesar documentos en lotes
    const cursor = collection.find({});

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) continue;

      const result = this.migrateCountryFields(doc);

      if (result.modified) {
        // Actualizar documento
        await collection.replaceOne({ _id: doc._id }, doc);
        migratedDocuments++;
        totalFieldsUpdated += result.fieldsUpdated;
        console.log(
          `    ✅ Documento ${doc._id} migrado (${result.fieldsUpdated} campos)`,
        );
      }
    }

    console.log(
      `    📈 Resultado: ${migratedDocuments}/${totalDocuments} documentos migrados`,
    );
    console.log(`    🔢 Total campos actualizados: ${totalFieldsUpdated}`);

    return {
      totalDocuments,
      migratedDocuments,
      fieldsUpdated: totalFieldsUpdated,
    };
  }

  /**
   * Migra todas las colecciones de un tenant
   */
  private async migrateTenant(tenantName: string): Promise<MigrationStats> {
    console.log(`\n🏢 Migrando tenant: ${tenantName}`);

    const stats: MigrationStats = {
      tenant: tenantName,
      collections: {},
      errors: [],
    };

    try {
      // Conectar a la DB del tenant
      const tenantDb = this.client.db(`tenant_${tenantName}`);

      // Colecciones a migrar
      const collectionsToMigrate = [
        'members',
        'offices',
        'shipments',
        'historial',
      ];

      for (const collectionName of collectionsToMigrate) {
        try {
          const result = await this.migrateCollection(tenantDb, collectionName);
          stats.collections[collectionName] = result;
        } catch (error) {
          const errorMsg = `Error en colección ${collectionName}: ${error.message}`;
          console.error(`    ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Error general en tenant ${tenantName}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    return stats;
  }

  /**
   * Migra la colección global de users
   */
  private async migrateGlobalUsers(): Promise<MigrationStats> {
    console.log(`\n🌍 Migrando colección global: users`);

    const stats: MigrationStats = {
      tenant: 'GLOBAL',
      collections: {},
      errors: [],
    };

    try {
      const result = await this.migrateCollection(this.mainDb, 'users');
      stats.collections['users'] = result;
    } catch (error) {
      const errorMsg = `Error en colección global users: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    return stats;
  }

  /**
   * Obtiene lista de tenants
   */
  private async getTenantList(): Promise<string[]> {
    console.log('🔍 Obteniendo lista de tenants...');

    // Primero intentar obtener de la colección tenants
    const tenantsCollection = this.mainDb.collection('tenants');
    const totalTenants = await tenantsCollection.countDocuments();

    let tenantNames: string[] = [];

    if (totalTenants > 0) {
      const tenants = await tenantsCollection
        .find(
          {},
          {
            projection: { tenantName: 1 },
          },
        )
        .toArray();

      tenantNames = tenants
        .map((t) => t.tenantName)
        .filter((name) => name && typeof name === 'string');
    }

    // Si no hay tenants en la colección, buscar en las bases de datos
    if (tenantNames.length === 0) {
      console.log('⚠️  Colección tenants vacía, buscando en bases de datos...');
      const adminDb = this.client.db().admin();
      const dbList = await adminDb.listDatabases();

      // Buscar bases de datos que no sean del sistema ni firstPlug
      const systemDbs = ['admin', 'config', 'local', 'firstPlug'];
      tenantNames = dbList.databases
        .filter((db) => !systemDbs.includes(db.name))
        .map((db) => db.name);
    }

    console.log(
      `📋 Encontrados ${tenantNames.length} tenants: ${tenantNames.join(', ')}`,
    );
    return tenantNames;
  }

  /**
   * Ejecuta la migración completa
   */
  async migrate(specificTenant?: string) {
    console.log('🚀 Iniciando migración de países → códigos de país');
    console.log('='.repeat(60));

    try {
      let tenantNames: string[];

      if (specificTenant) {
        tenantNames = [specificTenant];
        console.log(`🎯 Migrando solo el tenant: ${specificTenant}`);
      } else {
        tenantNames = await this.getTenantList();
      }

      // Migrar cada tenant
      for (const tenantName of tenantNames) {
        const tenantStats = await this.migrateTenant(tenantName);
        this.stats.push(tenantStats);
      }

      // Migrar colección global de users
      const globalStats = await this.migrateGlobalUsers();
      this.stats.push(globalStats);

      // Mostrar resumen final
      this.printFinalSummary();
    } catch (error) {
      console.error('💥 Error fatal en migración:', error);
      throw error;
    }
  }

  /**
   * Muestra resumen final
   */
  private printFinalSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL DE MIGRACIÓN');
    console.log('='.repeat(60));

    let totalDocuments = 0;
    let totalMigrated = 0;
    let totalFields = 0;
    let totalErrors = 0;

    this.stats.forEach((stat) => {
      console.log(`\n🏢 ${stat.tenant}:`);

      Object.entries(stat.collections).forEach(([collection, data]) => {
        console.log(
          `  📂 ${collection}: ${data.migratedDocuments}/${data.totalDocuments} docs, ${data.fieldsUpdated} campos`,
        );
        totalDocuments += data.totalDocuments;
        totalMigrated += data.migratedDocuments;
        totalFields += data.fieldsUpdated;
      });

      if (stat.errors.length > 0) {
        console.log(`  ❌ Errores: ${stat.errors.length}`);
        stat.errors.forEach((error) => console.log(`    - ${error}`));
        totalErrors += stat.errors.length;
      }
    });

    console.log('\n' + '-'.repeat(40));
    console.log(`📈 TOTALES:`);
    console.log(`   Documentos procesados: ${totalDocuments}`);
    console.log(`   Documentos migrados: ${totalMigrated}`);
    console.log(`   Campos actualizados: ${totalFields}`);
    console.log(`   Errores: ${totalErrors}`);

    if (totalErrors === 0) {
      console.log('\n✅ ¡Migración completada exitosamente!');
    } else {
      console.log(
        '\n⚠️  Migración completada con errores. Revisar logs arriba.',
      );
    }
  }
}

// Ejecutar migración
async function main() {
  // Obtener tenant específico de argumentos de línea de comandos
  const specificTenant = process.argv[2];

  const migrator = new CountryMigrator();

  try {
    await migrator.connect();

    await migrator.migrate(specificTenant);
  } catch (error) {
    console.error('💥 Error en migración:', error);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

export { CountryMigrator };
