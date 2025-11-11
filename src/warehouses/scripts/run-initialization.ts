import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { InitializeWarehousesScript } from './initialize-warehouses.script';

/**
 * Script standalone para inicializar warehouses
 * Ejecutar con: npm run init:warehouses
 */
async function runInitialization() {
  console.log('🚀 Starting warehouses initialization script...');
  console.log('📋 Creating NestJS application context...');

  let app;

  try {
    // Crear aplicación NestJS
    console.log('⚙️  Initializing NestJS application...');
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });
    console.log('✅ NestJS application context created');

    // Obtener el servicio de inicialización
    console.log('🔍 Getting InitializeWarehousesScript service...');
    const initScript = app.get(InitializeWarehousesScript);
    console.log('✅ InitializeWarehousesScript service obtained');

    // Ejecutar inicialización
    console.log('🚀 Starting warehouses initialization...');
    await initScript.initializeAllCountries();

    // Mostrar estado final
    console.log('📊 Checking final initialization status...');
    await initScript.checkInitializationStatus();

    console.log('✅ Initialization script completed successfully!');
  } catch (error) {
    console.error('❌ Error running initialization script:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cerrar aplicación
    if (app) {
      console.log('🔌 Closing NestJS application...');
      await app.close();
      console.log('✅ Application closed');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runInitialization();
}

export { runInitialization };
