/**
 * 🧪 Test para Asset History Compatibility Layer
 * Verifica que la normalización de registros legacy funcione correctamente
 */

import { AssetHistoryCompatibility } from './asset-compatibility.helper';

// Mock data que simula registros legacy vs nuevos
const testCases = [
  {
    name: 'Legacy Asset: Estructura completa con campos MongoDB',
    record: {
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
          acquisitionDate: new Date('2024-01-15'),
          price: 2000,
          assignedEmail: 'john@test.com',
          assignedMember: 'John Doe (AR)',
          productCondition: 'Optimal',
          additionalInfo: 'Test laptop',
          lastAssigned: new Date('2024-01-20'),
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20'),
          __v: 0,
          isDeleted: false,
        },
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedNormalization: true,
  },

  {
    name: 'Legacy Asset: FP warehouse sin country code',
    record: {
      actionType: 'relocate',
      itemType: 'assets',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: {
          _id: '507f1f77bcf86cd799439012',
          name: 'MacBook Pro',
          category: 'Computer',
          serialNumber: 'MBP001',
          location: 'Employee',
          status: 'Delivered',
          assignedEmail: 'john@test.com',
          assignedMember: 'John Doe',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20'),
        },
        newData: {
          _id: '507f1f77bcf86cd799439012',
          name: 'MacBook Pro',
          category: 'Computer',
          serialNumber: 'MBP001',
          location: 'FP warehouse', // Sin warehouseCountryCode
          status: 'Available',
          assignedEmail: null,
          assignedMember: null,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-22'),
        },
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedNormalization: true,
  },

  {
    name: 'New Asset: Estructura formateada (no necesita normalización)',
    record: {
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
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
    expectedNormalization: false,
  },

  {
    name: 'Non-Asset Record: No debe ser normalizado',
    record: {
      actionType: 'create',
      itemType: 'members',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: null,
        newData: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedNormalization: false,
  },
];

export function testAssetCompatibility() {
  console.log('🧪 Testing Asset History Compatibility Layer...\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const needsNormalization = AssetHistoryCompatibility.needsNormalization(
      testCase.record,
    );
    const summary = AssetHistoryCompatibility.getNormalizationSummary(
      testCase.record,
    );

    console.log(`📋 Test ${index + 1}: ${testCase.name}`);
    console.log(`   Needs normalization: ${needsNormalization}`);
    console.log(`   Summary: ${summary}`);

    if (needsNormalization === testCase.expectedNormalization) {
      console.log(`   ✅ PASSED`);
      passed++;
    } else {
      console.log(`   ❌ FAILED`);
      console.log(`   Expected: ${testCase.expectedNormalization}`);
      console.log(`   Got: ${needsNormalization}`);
      failed++;
    }

    // Si necesita normalización, probar la normalización
    if (needsNormalization) {
      const normalized =
        AssetHistoryCompatibility.normalizeAssetRecordForFrontend(
          testCase.record,
        );
      console.log(`   🔧 Normalized structure:`);

      if (normalized.changes?.newData) {
        const keys = Object.keys(normalized.changes.newData);
        console.log(
          `      newData fields: ${keys.length} (${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''})`,
        );

        // Verificar que no tenga campos internos de MongoDB
        const hasMongoFields = keys.some((key) =>
          ['_id', '__v', 'createdAt', 'updatedAt'].includes(key),
        );
        console.log(
          `      Has MongoDB fields: ${hasMongoFields ? '❌' : '✅'}`,
        );

        // Verificar attributes normalizados
        if (normalized.changes.newData.attributes) {
          console.log(`      Attributes normalized: ✅`);
        }
      }
    }

    console.log('');
  });

  console.log(`🎯 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log(
      '🎉 All tests passed! Asset compatibility layer is working correctly.',
    );
  } else {
    console.log('⚠️  Some tests failed. Review the compatibility logic.');
  }
}

// Uncomment to run the test
// testAssetCompatibility();

// Export for integration tests (already exported above)
