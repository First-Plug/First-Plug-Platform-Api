/**
 * 🧪 Integration Test para History Compatibility System
 * Verifica que todo el sistema de compatibilidad funcione correctamente
 * con registros legacy y nuevos
 */

import { LegacyRecordDetector } from './helpers/legacy-detector.helper';
import { AssetHistoryCompatibility } from './helpers/asset-compatibility.helper';
import { SafeTeamPopulation } from './helpers/safe-team-population.helper';
import { HistoryContext } from './types/history.types';

// Mock data que simula registros reales de producción
const mockLegacyRecords = [
  {
    _id: 'legacy1',
    actionType: 'create',
    itemType: 'assets',
    userId: '507f1f77bcf86cd799439011',
    changes: {
      oldData: null,
      newData: {
        _id: '507f1f77bcf86cd799439012',
        name: 'MacBook Pro',
        category: 'Computer',
        serialNumber: 'MBP001',
        location: 'Employee',
        status: 'Delivered',
        recoverable: true,
        attributes: [
          { key: 'brand', value: 'Apple' },
          { key: 'model', value: 'MacBook Pro M2' },
        ],
        assignedEmail: 'john@test.com',
        assignedMember: 'John Doe (AR)',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
        __v: 0,
      },
    },
    context: 'setup-default-office', // Legacy context
    createdAt: new Date('2024-10-15T10:00:00Z'),
  },

  {
    _id: 'legacy2',
    actionType: 'relocate',
    itemType: 'assets',
    userId: '507f1f77bcf86cd799439011',
    changes: {
      oldData: {
        _id: '507f1f77bcf86cd799439012',
        name: 'MacBook Pro',
        location: 'Employee',
        assignedMember: 'John Doe',
      },
      newData: {
        _id: '507f1f77bcf86cd799439012',
        name: 'MacBook Pro',
        location: 'FP warehouse', // Sin warehouseCountryCode
        assignedMember: null,
      },
    },
    createdAt: new Date('2024-10-15T10:00:00Z'),
  },

  {
    _id: 'legacy3',
    actionType: 'bulk-create',
    itemType: 'members',
    userId: '507f1f77bcf86cd799439011',
    changes: {
      oldData: null,
      newData: [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          team: '507f1f77bcf86cd799439013', // Valid ObjectId
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          team: 'invalid-team-id', // Invalid ObjectId
        },
      ],
    },
    context: 'office-address-update', // Legacy context
    createdAt: new Date('2024-10-15T10:00:00Z'),
  },
];

const mockNewRecords = [
  {
    _id: 'new1',
    actionType: 'update',
    itemType: 'assets',
    userId: '507f1f77bcf86cd799439011',
    changes: {
      oldData: {
        category: 'Computer',
        name: 'MacBook Pro',
        serialNumber: 'MBP001',
        location: 'Employee',
      },
      newData: {
        category: 'Computer',
        name: 'MacBook Pro M2',
        serialNumber: 'MBP001',
        location: 'Employee',
      },
    },
    context: 'single-product' as HistoryContext,
    createdAt: new Date('2024-12-15T10:00:00Z'),
  },

  {
    _id: 'new2',
    actionType: 'create',
    itemType: 'members',
    userId: '507f1f77bcf86cd799439011',
    changes: {
      oldData: null,
      newData: {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@test.com',
        team: '507f1f77bcf86cd799439013',
      },
    },
    context: 'member-address-update' as HistoryContext,
    createdAt: new Date('2024-12-15T10:00:00Z'),
  },
];

// Mock del teamRepository
const mockTeamRepository = {
  findById: (id: string) => ({
    exec: async () => {
      const validTeams = {
        '507f1f77bcf86cd799439013': {
          _id: '507f1f77bcf86cd799439013',
          name: 'Development Team',
        },
      };
      return validTeams[id] || null;
    },
  }),
} as any;

export async function runCompatibilityIntegrationTest() {
  console.log('🧪 Running History Compatibility Integration Test...\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const testResults = {
    legacyDetection: { passed: 0, failed: 0 },
    contextValidation: { passed: 0, failed: 0 },
    assetCompatibility: { passed: 0, failed: 0 },
    teamPopulation: { passed: 0, failed: 0 },
    integration: { passed: 0, failed: 0 },
  };

  // Test 1: Legacy Detection
  console.log('📋 Test 1: Legacy Detection');
  for (const record of mockLegacyRecords) {
    totalTests++;
    const isLegacy = LegacyRecordDetector.isLegacyRecord(record);
    const summary = LegacyRecordDetector.getDetectionSummary(record);

    console.log(
      `   Record ${record._id}: ${isLegacy ? '✅' : '❌'} (${summary})`,
    );

    if (isLegacy) {
      passedTests++;
      testResults.legacyDetection.passed++;
    } else {
      failedTests++;
      testResults.legacyDetection.failed++;
    }
  }

  for (const record of mockNewRecords) {
    totalTests++;
    const isLegacy = LegacyRecordDetector.isLegacyRecord(record);

    console.log(
      `   Record ${record._id}: ${!isLegacy ? '✅' : '❌'} (should be NEW)`,
    );

    if (!isLegacy) {
      passedTests++;
      testResults.legacyDetection.passed++;
    } else {
      failedTests++;
      testResults.legacyDetection.failed++;
    }
  }

  console.log('');

  // Test 2: Asset Compatibility
  console.log('📋 Test 2: Asset Compatibility');
  const assetRecords = [...mockLegacyRecords, ...mockNewRecords].filter(
    (r) => r.itemType === 'assets',
  );

  for (const record of assetRecords) {
    totalTests++;
    const needsNormalization =
      AssetHistoryCompatibility.needsNormalization(record);
    const isLegacy = LegacyRecordDetector.isLegacyRecord(record);

    console.log(
      `   Record ${record._id}: Needs normalization: ${needsNormalization}, Is legacy: ${isLegacy}`,
    );

    if (needsNormalization === isLegacy) {
      passedTests++;
      testResults.assetCompatibility.passed++;

      // Test normalization
      const normalized =
        AssetHistoryCompatibility.normalizeAssetRecordForFrontend(record);
      const summary = AssetHistoryCompatibility.getNormalizationSummary(record);
      console.log(`     Normalization: ${summary}`);

      // Verificar que no tenga campos MongoDB en registros legacy normalizados
      if (isLegacy && normalized.changes?.newData) {
        const hasMongoFields = Object.keys(normalized.changes.newData).some(
          (key) => ['_id', '__v', 'createdAt', 'updatedAt'].includes(key),
        );
        console.log(
          `     MongoDB fields removed: ${!hasMongoFields ? '✅' : '❌'}`,
        );
      }
    } else {
      failedTests++;
      testResults.assetCompatibility.failed++;
    }
  }

  console.log('');

  // Test 3: Safe Team Population
  console.log('📋 Test 3: Safe Team Population');
  const memberRecords = [...mockLegacyRecords, ...mockNewRecords].filter(
    (r) => r.itemType === 'members',
  );

  for (const record of memberRecords) {
    totalTests++;
    const recordCopy = JSON.parse(JSON.stringify(record));

    console.log(`   Record ${record._id}: Testing team population...`);

    try {
      await SafeTeamPopulation.populateTeamsInHistoryRecord(
        mockTeamRepository,
        recordCopy,
      );

      // Verificar resultados
      let populationWorked = false;

      if (
        recordCopy.actionType === 'bulk-create' &&
        Array.isArray(recordCopy.changes?.newData)
      ) {
        const members = recordCopy.changes.newData;
        const validPopulations = members.filter(
          (m) => m.team && typeof m.team === 'object' && m.team.name,
        ).length;
        const invalidTeams = members.filter(
          (m) =>
            m.team &&
            typeof m.team === 'string' &&
            m.team === 'invalid-team-id',
        ).length;

        console.log(
          `     Valid populations: ${validPopulations}, Invalid teams handled: ${invalidTeams}`,
        );
        populationWorked = validPopulations > 0; // Al menos uno debería funcionar
      } else if (recordCopy.changes?.newData?.team) {
        populationWorked = typeof recordCopy.changes.newData.team === 'object';
        console.log(`     Team populated: ${populationWorked ? '✅' : '❌'}`);
      }

      if (populationWorked) {
        passedTests++;
        testResults.teamPopulation.passed++;
      } else {
        failedTests++;
        testResults.teamPopulation.failed++;
      }
    } catch (error) {
      console.log(`     ❌ Error during population: ${error.message}`);
      failedTests++;
      testResults.teamPopulation.failed++;
    }
  }

  console.log('');

  // Test 4: Integration Test - Simular HistoryService.findAll()
  console.log('📋 Test 4: Integration Test');
  const allRecords = [...mockLegacyRecords, ...mockNewRecords];

  totalTests++;
  try {
    // Simular el procesamiento completo como en HistoryService
    const processedRecords: any[] = [];

    for (const record of allRecords) {
      let processedRecord = { ...record };

      // 1. Detectar si es legacy
      const isLegacy = LegacyRecordDetector.isLegacyRecord(processedRecord);

      // 2. Solo aplicar transformaciones warehouse a registros nuevos
      if (!isLegacy) {
        // Simular transformWarehouseLocations (no aplicar a legacy)
        console.log(
          `     Applying warehouse transformations to new record ${record._id}`,
        );
      }

      // 3. Population segura de teams
      await SafeTeamPopulation.populateTeamsInHistoryRecord(
        mockTeamRepository,
        processedRecord,
      );

      // 4. Normalización de assets legacy
      if (processedRecord.itemType === 'assets') {
        processedRecord =
          AssetHistoryCompatibility.normalizeAssetRecordForFrontend(
            processedRecord,
          );
      }

      processedRecords.push(processedRecord);
    }

    console.log(
      `   ✅ Successfully processed ${processedRecords.length} records`,
    );
    console.log(
      `     Legacy records: ${processedRecords.filter((r) => LegacyRecordDetector.isLegacyRecord(r)).length}`,
    );
    console.log(
      `     New records: ${processedRecords.filter((r) => !LegacyRecordDetector.isLegacyRecord(r)).length}`,
    );

    passedTests++;
    testResults.integration.passed++;
  } catch (error) {
    console.log(`   ❌ Integration test failed: ${error.message}`);
    failedTests++;
    testResults.integration.failed++;
  }

  console.log('');

  // Resumen final
  console.log('🎯 Test Results Summary:');
  console.log(
    `   Legacy Detection: ${testResults.legacyDetection.passed}✅ ${testResults.legacyDetection.failed}❌`,
  );
  console.log(
    `   Asset Compatibility: ${testResults.assetCompatibility.passed}✅ ${testResults.assetCompatibility.failed}❌`,
  );
  console.log(
    `   Team Population: ${testResults.teamPopulation.passed}✅ ${testResults.teamPopulation.failed}❌`,
  );
  console.log(
    `   Integration: ${testResults.integration.passed}✅ ${testResults.integration.failed}❌`,
  );
  console.log('');
  console.log(
    `📊 Overall: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`,
  );

  if (failedTests === 0) {
    console.log(
      '🎉 ALL TESTS PASSED! History compatibility system is working correctly.',
    );
    console.log('✅ Ready for production deployment.');
  } else {
    console.log(
      `⚠️  ${failedTests} tests failed. Review the implementation before deployment.`,
    );
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: Math.round((passedTests / totalTests) * 100),
    details: testResults,
  };
}

// Uncomment to run the test
// runCompatibilityIntegrationTest();

/**
 * 🚀 Ejecutar todos los tests de compatibilidad
 */
export async function runAllCompatibilityTests() {
  console.log('🧪 Running ALL History Compatibility Tests...\n');
  console.log('='.repeat(60));

  try {
    // Test individual helpers
    console.log('🔧 Testing individual helpers...\n');

    // Importar y ejecutar tests individuales
    const { testLegacyDetector } = await import(
      './helpers/test-legacy-detector'
    );
    const { testAssetCompatibility } = await import(
      './helpers/test-asset-compatibility'
    );
    const { testSafeTeamPopulation } = await import(
      './helpers/test-safe-team-population'
    );

    console.log('1️⃣ Legacy Detector Tests:');
    testLegacyDetector();
    console.log('\n' + '-'.repeat(40) + '\n');

    console.log('2️⃣ Asset Compatibility Tests:');
    testAssetCompatibility();
    console.log('\n' + '-'.repeat(40) + '\n');

    console.log('3️⃣ Safe Team Population Tests:');
    await testSafeTeamPopulation();
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test integración completa
    console.log('4️⃣ Integration Tests:');
    const integrationResults = await runCompatibilityIntegrationTest();

    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL RESULTS:');
    console.log(`   Success Rate: ${integrationResults.successRate}%`);
    console.log(`   Total Tests: ${integrationResults.totalTests}`);
    console.log(`   Passed: ${integrationResults.passedTests}`);
    console.log(`   Failed: ${integrationResults.failedTests}`);

    if (integrationResults.failedTests === 0) {
      console.log('\n🎉 ALL COMPATIBILITY TESTS PASSED!');
      console.log('✅ System is ready for production deployment.');
      console.log('\n📋 Next Steps:');
      console.log('   1. Deploy to staging environment');
      console.log('   2. Test with real production data sample');
      console.log('   3. Monitor logs for any warnings');
      console.log('   4. Deploy to production');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED!');
      console.log('❌ Review implementation before deployment.');
      console.log('\n🔧 Recommended Actions:');
      console.log('   1. Fix failing tests');
      console.log('   2. Re-run test suite');
      console.log('   3. Test with production data sample');
    }

    return integrationResults;
  } catch (error) {
    console.error('💥 Error running compatibility tests:', error);
    throw error;
  }
}
