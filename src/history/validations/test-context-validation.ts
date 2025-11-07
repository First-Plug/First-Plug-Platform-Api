/**
 * 🧪 Test rápido para verificar que la validación de contexts funciona
 * Este archivo es temporal y se puede eliminar después de verificar
 */

import { CreateHistorySchema } from './create-history.zod';

// Test data con contexts legacy
const testCases = [
  {
    name: 'Context legacy: setup-default-office',
    data: {
      actionType: 'create',
      userId: '507f1f77bcf86cd799439011',
      itemType: 'offices',
      changes: {
        oldData: null,
        newData: { name: 'Test Office' },
        context: 'setup-default-office',
      },
    },
  },
  {
    name: 'Context legacy: office-address-update',
    data: {
      actionType: 'update',
      userId: '507f1f77bcf86cd799439011',
      itemType: 'offices',
      changes: {
        oldData: { address: 'Old Address' },
        newData: { address: 'New Address' },
        context: 'office-address-update',
      },
    },
  },
  {
    name: 'Context nuevo: single-product',
    data: {
      actionType: 'create',
      userId: '507f1f77bcf86cd799439011',
      itemType: 'assets',
      changes: {
        oldData: null,
        newData: { name: 'Test Product' },
        context: 'single-product',
      },
    },
  },
];

export function testContextValidation() {
  console.log('🧪 Testing context validation...\n');

  testCases.forEach((testCase) => {
    try {
      CreateHistorySchema.parse(testCase.data);
      console.log(`✅ ${testCase.name}: PASSED`);
    } catch (error) {
      console.log(`❌ ${testCase.name}: FAILED`);
      console.log(`   Error: ${error.message}`);
    }
  });

  console.log('\n🎯 Context validation test completed!');
}

// Uncomment to run the test
// testContextValidation();
