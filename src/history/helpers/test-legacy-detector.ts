/**
 * 🧪 Test para Legacy Record Detector
 * Verifica que la detección de registros legacy funcione correctamente
 */

import { LegacyRecordDetector } from './legacy-detector.helper';

// Mock data que simula registros legacy vs nuevos
const testCases = [
  {
    name: 'Legacy: Context setup-default-office',
    record: {
      actionType: 'create',
      itemType: 'offices',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: null,
        newData: { name: 'Default Office' },
        context: 'setup-default-office',
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedLegacy: true,
  },

  {
    name: 'Legacy: Asset sin formatear (estructura completa)',
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
          attributes: [{ key: 'brand', value: 'Apple' }],
          acquisitionDate: new Date(),
          price: 2000,
          assignedEmail: 'user@test.com',
          assignedMember: 'John Doe',
          productCondition: 'Optimal',
          additionalInfo: 'Test info',
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0,
        },
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedLegacy: true,
  },

  {
    name: 'Legacy: FP warehouse sin warehouseCountryCode',
    record: {
      actionType: 'update',
      itemType: 'assets',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: { location: 'Employee' },
        newData: { location: 'FP warehouse' }, // Sin warehouseCountryCode
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
    expectedLegacy: true,
  },

  {
    name: 'Legacy: Creado antes de migración',
    record: {
      actionType: 'create',
      itemType: 'members',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: null,
        newData: { firstName: 'John', lastName: 'Doe' },
      },
      createdAt: new Date('2024-11-15T10:00:00Z'), // Antes del cutoff
    },
    expectedLegacy: true,
  },

  {
    name: 'Nuevo: Asset formateado (estructura selectiva)',
    record: {
      actionType: 'update',
      itemType: 'assets',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: {
          category: 'Computer',
          name: 'MacBook Pro',
          serialNumber: 'MBP001',
        },
        newData: {
          category: 'Computer',
          name: 'MacBook Pro M2',
          serialNumber: 'MBP001',
        },
      },
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
    expectedLegacy: false,
  },

  {
    name: 'Nuevo: FP warehouse con warehouseCountryCode',
    record: {
      actionType: 'relocate',
      itemType: 'assets',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: { location: 'Employee' },
        newData: {
          location: 'FP warehouse',
          warehouseCountryCode: 'AR',
        },
      },
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
    expectedLegacy: false,
  },

  {
    name: 'Nuevo: Context single-product',
    record: {
      actionType: 'create',
      itemType: 'assets',
      userId: '507f1f77bcf86cd799439011',
      changes: {
        oldData: null,
        newData: {
          category: 'Computer',
          name: 'MacBook Pro',
          serialNumber: 'MBP001',
        },
        context: 'single-product',
      },
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
    expectedLegacy: false,
  },
];

export function testLegacyDetector() {
  console.log('🧪 Testing Legacy Record Detector...\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const isLegacy = LegacyRecordDetector.isLegacyRecord(testCase.record);
    const summary = LegacyRecordDetector.getDetectionSummary(testCase.record);

    if (isLegacy === testCase.expectedLegacy) {
      console.log(`✅ Test ${index + 1}: ${testCase.name}`);
      console.log(`   Result: ${summary}`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1}: ${testCase.name}`);
      console.log(`   Expected: ${testCase.expectedLegacy ? 'LEGACY' : 'NEW'}`);
      console.log(`   Got: ${summary}`);
      failed++;
    }
    console.log('');
  });

  console.log(`🎯 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Legacy detector is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Review the detector logic.');
  }
}

// Uncomment to run the test
// testLegacyDetector();

// Export for integration tests (already exported above)
