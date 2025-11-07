/**
 * 🧪 Script temporal para ejecutar tests de compatibilidad
 * Ejecuta este archivo para probar todo el sistema
 */

import { testLegacyDetector } from './helpers/test-legacy-detector';
import { testAssetCompatibility } from './helpers/test-asset-compatibility';
import { testSafeTeamPopulation } from './helpers/test-safe-team-population';
import { runCompatibilityIntegrationTest } from './test-compatibility-integration';

async function runTests() {
  console.log('🚀 Ejecutando Tests de Compatibilidad History/Activity...\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Legacy Detector
    console.log('\n1️⃣ LEGACY DETECTOR TESTS:');
    console.log('-'.repeat(40));
    testLegacyDetector();

    // Test 2: Asset Compatibility
    console.log('\n2️⃣ ASSET COMPATIBILITY TESTS:');
    console.log('-'.repeat(40));
    testAssetCompatibility();

    // Test 3: Safe Team Population
    console.log('\n3️⃣ SAFE TEAM POPULATION TESTS:');
    console.log('-'.repeat(40));
    await testSafeTeamPopulation();

    // Test 4: Integration Test
    console.log('\n4️⃣ INTEGRATION TESTS:');
    console.log('-'.repeat(40));
    const results = await runCompatibilityIntegrationTest();

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('🎯 RESUMEN FINAL:');
    console.log(`   Success Rate: ${results.successRate}%`);
    console.log(`   Total Tests: ${results.totalTests}`);
    console.log(`   Passed: ${results.passedTests}`);
    console.log(`   Failed: ${results.failedTests}`);

    if (results.failedTests === 0) {
      console.log('\n🎉 ¡TODOS LOS TESTS PASARON!');
      console.log('✅ El sistema está listo para producción.');
    } else {
      console.log('\n⚠️  Algunos tests fallaron.');
      console.log('❌ Revisar la implementación antes del deploy.');
    }
  } catch (error) {
    console.error('\n💥 Error ejecutando tests:', error);
  }
}

// Ejecutar los tests
runTests();
