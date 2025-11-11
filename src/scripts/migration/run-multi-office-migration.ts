import { runMultiOfficeMigration } from './multi-office-migration';
import { runMultiOfficeValidation } from '../validation/multi-office-validation';

/**
 * Script principal para ejecutar la migración completa Multi-Office
 * 
 * Este script ejecuta:
 * 1. Migración de datos existentes
 * 2. Validación de integridad post-migración
 * 3. Reporte final de resultados
 */
async function runCompleteMigration() {
  console.log('🚀 Iniciando migración completa Multi-Office...\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Ejecutar migración
    console.log('📋 FASE 1: MIGRACIÓN DE DATOS');
    console.log('=' .repeat(50));
    await runMultiOfficeMigration();
    
    console.log('\n⏳ Esperando 2 segundos antes de la validación...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Ejecutar validación
    console.log('\n📋 FASE 2: VALIDACIÓN DE INTEGRIDAD');
    console.log('=' .repeat(50));
    await runMultiOfficeValidation();
    
    // 3. Reporte final
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n📋 MIGRACIÓN COMPLETA FINALIZADA');
    console.log('=' .repeat(50));
    console.log(`⏱️ Tiempo total: ${duration} segundos`);
    console.log('🎉 Migración Multi-Office completada exitosamente!');
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('1. Verificar que no hay inconsistencias reportadas');
    console.log('2. Probar funcionalidad multi-office en desarrollo');
    console.log('3. Ejecutar tests unitarios e integración');
    console.log('4. Desplegar en staging para pruebas adicionales');
    
  } catch (error) {
    console.error('\n❌ Error durante la migración completa:', error);
    console.log('\n🔧 ACCIONES RECOMENDADAS:');
    console.log('1. Revisar logs de error detallados');
    console.log('2. Verificar conectividad a base de datos');
    console.log('3. Asegurar que todos los tenants tienen oficina default');
    console.log('4. Ejecutar migración manualmente por tenant si es necesario');
    process.exit(1);
  }
}

// Ejecutar migración completa si se llama directamente
if (require.main === module) {
  runCompleteMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error ejecutando migración completa:', error);
      process.exit(1);
    });
}

export { runCompleteMigration };
