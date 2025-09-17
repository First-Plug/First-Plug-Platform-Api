#!/usr/bin/env ts-node

/**
 * Script de prueba para migración de países
 * 
 * Permite probar la migración en modo DRY-RUN (sin modificar datos)
 * o ejecutar migración real en un tenant específico.
 */

import { MongoClient, Db } from 'mongodb';
import { countryCodes } from '../shipments/helpers/countryCodes';

// Configuración
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MAIN_DB_NAME = process.env.MAIN_DB_NAME || 'first-plug';

// Mapeo de nombres → códigos
const COUNTRY_MAPPING: Record<string, string> = {
  ...countryCodes,
  'Our office': 'OO',
  'FP warehouse': 'FP',
};

class MigrationTester {
  private client: MongoClient;
  private mainDb: Db;

  constructor() {
    this.client = new MongoClient(MONGO_URI);
  }

  async connect() {
    await this.client.connect();
    this.mainDb = this.client.db(MAIN_DB_NAME);
    console.log('✅ Conectado a MongoDB');
  }

  async disconnect() {
    await this.client.close();
  }

  /**
   * Analiza qué cambios se harían sin ejecutarlos
   */
  async dryRun(tenantName: string) {
    console.log(`🔍 DRY RUN - Analizando tenant: ${tenantName}`);
    console.log('=' .repeat(50));

    const tenantDb = this.client.db(`tenant_${tenantName}`);
    const collections = ['members', 'offices', 'shipments', 'historial'];

    for (const collectionName of collections) {
      console.log(`\n📂 Analizando: ${collectionName}`);
      
      const collection = tenantDb.collection(collectionName);
      const totalDocs = await collection.countDocuments();
      
      if (totalDocs === 0) {
        console.log('  ℹ️  Colección vacía');
        continue;
      }

      console.log(`  📊 Total documentos: ${totalDocs}`);
      
      // Buscar documentos con campos country que necesiten migración
      const docsWithCountry = await collection.find({
        $or: [
          { country: { $exists: true, $ne: '' } },
          { 'originDetails.country': { $exists: true, $ne: '' } },
          { 'destinationDetails.country': { $exists: true, $ne: '' } },
          { 'changes.oldData.country': { $exists: true } },
          { 'changes.newData.country': { $exists: true } }
        ]
      }).toArray();

      console.log(`  🎯 Documentos con campos country: ${docsWithCountry.length}`);

      // Analizar qué cambios se harían
      let changesCount = 0;
      const countryValues = new Set<string>();

      docsWithCountry.forEach(doc => {
        this.analyzeDocument(doc, countryValues, (field, oldValue, newValue) => {
          console.log(`    🔄 ${field}: "${oldValue}" → "${newValue}"`);
          changesCount++;
        });
      });

      console.log(`  📈 Total cambios que se harían: ${changesCount}`);
      console.log(`  🌍 Países encontrados: ${Array.from(countryValues).join(', ')}`);
    }
  }

  /**
   * Analiza un documento recursivamente
   */
  private analyzeDocument(
    obj: any, 
    countryValues: Set<string>, 
    onChangeFound: (field: string, oldValue: string, newValue: string) => void,
    path: string = ''
  ) {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (key === 'country' && typeof obj[key] === 'string' && obj[key].trim()) {
        const oldValue = obj[key].trim();
        countryValues.add(oldValue);
        
        const newValue = this.convertCountryNameToCode(oldValue);
        if (newValue && newValue !== oldValue) {
          onChangeFound(currentPath, oldValue, newValue);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.analyzeDocument(obj[key], countryValues, onChangeFound, currentPath);
      }
    }
  }

  /**
   * Convierte nombre de país a código
   */
  private convertCountryNameToCode(countryName: string): string | null {
    if (!countryName || typeof countryName !== 'string') return null;

    const trimmed = countryName.trim();
    
    // Si ya es un código válido, devolverlo
    if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
      return trimmed;
    }

    return COUNTRY_MAPPING[trimmed] || null;
  }

  /**
   * Lista todos los tenants disponibles
   */
  async listTenants() {
    console.log('🏢 Tenants disponibles:');
    console.log('=' .repeat(30));

    const tenantsCollection = this.mainDb.collection('tenants');
    const tenants = await tenantsCollection.find({}, { 
      projection: { tenantName: 1, name: 1 } 
    }).toArray();

    tenants.forEach((tenant, index) => {
      console.log(`${index + 1}. ${tenant.tenantName} (${tenant.name || 'Sin nombre'})`);
    });

    return tenants.map(t => t.tenantName).filter(Boolean);
  }

  /**
   * Verifica el estado actual de un tenant
   */
  async checkTenantStatus(tenantName: string) {
    console.log(`🔍 Estado actual del tenant: ${tenantName}`);
    console.log('=' .repeat(40));

    const tenantDb = this.client.db(`tenant_${tenantName}`);
    const collections = ['members', 'offices', 'shipments', 'historial'];

    for (const collectionName of collections) {
      const collection = tenantDb.collection(collectionName);
      const total = await collection.countDocuments();
      
      if (total === 0) continue;

      // Contar documentos con códigos vs nombres
      const withCodes = await collection.countDocuments({
        $or: [
          { country: /^[A-Z]{2}$/ },
          { 'originDetails.country': /^[A-Z]{2}$/ },
          { 'destinationDetails.country': /^[A-Z]{2}$/ }
        ]
      });

      const withNames = await collection.countDocuments({
        $or: [
          { country: { $exists: true, $not: /^[A-Z]{2}$/, $ne: '' } },
          { 'originDetails.country': { $exists: true, $not: /^[A-Z]{2}$/, $ne: '' } },
          { 'destinationDetails.country': { $exists: true, $not: /^[A-Z]{2}$/, $ne: '' } }
        ]
      });

      console.log(`📂 ${collectionName}:`);
      console.log(`  Total: ${total}`);
      console.log(`  Con códigos: ${withCodes}`);
      console.log(`  Con nombres: ${withNames}`);
      console.log(`  Estado: ${withNames === 0 ? '✅ Migrado' : '⚠️  Pendiente'}`);
    }
  }
}

// Función principal
async function main() {
  const tester = new MigrationTester();
  
  try {
    await tester.connect();
    
    const command = process.argv[2];
    const tenantName = process.argv[3];

    switch (command) {
      case 'list':
        await tester.listTenants();
        break;
        
      case 'status':
        if (!tenantName) {
          console.error('❌ Especifica un tenant: npm run test-migration status <tenant>');
          process.exit(1);
        }
        await tester.checkTenantStatus(tenantName);
        break;
        
      case 'dry-run':
        if (!tenantName) {
          console.error('❌ Especifica un tenant: npm run test-migration dry-run <tenant>');
          process.exit(1);
        }
        await tester.dryRun(tenantName);
        break;
        
      default:
        console.log('📋 Comandos disponibles:');
        console.log('  npm run test-migration list                    # Lista todos los tenants');
        console.log('  npm run test-migration status <tenant>        # Estado actual del tenant');
        console.log('  npm run test-migration dry-run <tenant>       # Simula migración sin cambios');
        break;
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  } finally {
    await tester.disconnect();
  }
}

if (require.main === module) {
  main();
}
