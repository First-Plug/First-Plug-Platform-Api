/**
 * 🧪 Test para Safe Team Population Helper
 * Verifica que la population de teams sea segura para registros legacy y nuevos
 */

import { SafeTeamPopulation } from './safe-team-population.helper';

// Mock del teamRepository
const mockTeamRepository = {
  findById: (id: string) => ({
    exec: async () => {
      // Simular teams válidos
      const validTeams = {
        '507f1f77bcf86cd799439011': {
          _id: '507f1f77bcf86cd799439011',
          name: 'Development Team',
        },
        '507f1f77bcf86cd799439012': {
          _id: '507f1f77bcf86cd799439012',
          name: 'QA Team',
        },
        '507f1f77bcf86cd799439013': {
          _id: '507f1f77bcf86cd799439013',
          name: 'Design Team',
        },
      };

      return validTeams[id] || null;
    },
  }),
} as any;

// Test cases
const testCases = [
  {
    name: 'Valid ObjectId - Should populate successfully',
    data: { team: '507f1f77bcf86cd799439011' },
    expectedSuccess: true,
  },

  {
    name: 'Invalid ObjectId - Should fail gracefully',
    data: { team: 'invalid-id' },
    expectedSuccess: false,
  },

  {
    name: 'Non-existent team - Should fail gracefully',
    data: { team: '507f1f77bcf86cd799439999' },
    expectedSuccess: false,
  },

  {
    name: 'No team field - Should return false',
    data: { name: 'John Doe' },
    expectedSuccess: false,
  },

  {
    name: 'Team is null - Should return false',
    data: { team: null },
    expectedSuccess: false,
  },

  {
    name: 'Team is not string - Should return false',
    data: { team: 123 },
    expectedSuccess: false,
  },

  {
    name: 'Nested team path - Should work with dot notation',
    data: { user: { team: '507f1f77bcf86cd799439012' } },
    fieldPath: 'user.team',
    expectedSuccess: true,
  },
];

// Test records para population completa
const testRecords = [
  {
    name: 'Legacy Member Create',
    record: {
      _id: 'record1',
      itemType: 'members',
      actionType: 'create',
      changes: {
        oldData: null,
        newData: {
          firstName: 'John',
          lastName: 'Doe',
          team: '507f1f77bcf86cd799439011',
        },
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
  },

  {
    name: 'Bulk Create Members',
    record: {
      _id: 'record2',
      itemType: 'members',
      actionType: 'bulk-create',
      changes: {
        oldData: null,
        newData: [
          { firstName: 'John', team: '507f1f77bcf86cd799439011' },
          { firstName: 'Jane', team: '507f1f77bcf86cd799439012' },
          { firstName: 'Bob', team: 'invalid-id' }, // Este debería fallar
          { firstName: 'Alice' }, // Sin team
        ],
      },
      createdAt: new Date('2024-10-15T10:00:00Z'),
    },
  },

  {
    name: 'Team Assignment',
    record: {
      _id: 'record3',
      itemType: 'teams',
      actionType: 'assign',
      changes: {
        oldData: { team: '507f1f77bcf86cd799439011' },
        newData: { team: '507f1f77bcf86cd799439012' },
      },
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
  },

  {
    name: 'Non-team record - Should be ignored',
    record: {
      _id: 'record4',
      itemType: 'assets',
      actionType: 'create',
      changes: {
        oldData: null,
        newData: { name: 'MacBook Pro' },
      },
      createdAt: new Date('2024-12-15T10:00:00Z'),
    },
  },
];

export async function testSafeTeamPopulation() {
  console.log('🧪 Testing Safe Team Population Helper...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Individual team population
  console.log('📋 Test 1: Individual Team Population');
  for (const testCase of testCases) {
    const fieldPath = testCase.fieldPath || 'team';
    const success = await SafeTeamPopulation.populateTeamSafely(
      mockTeamRepository,
      testCase.data,
      fieldPath,
    );

    console.log(`   ${testCase.name}: ${success ? '✅' : '❌'}`);

    if (success === testCase.expectedSuccess) {
      passed++;
    } else {
      failed++;
      console.log(
        `     Expected: ${testCase.expectedSuccess}, Got: ${success}`,
      );
    }

    // Verificar que la population realmente ocurrió
    if (success && testCase.expectedSuccess) {
      const teamValue = SafeTeamPopulation['getNestedValue'](
        testCase.data,
        fieldPath,
      );
      if (typeof teamValue === 'object' && teamValue.name) {
        console.log(`     ✅ Team populated: ${teamValue.name}`);
      }
    }
  }

  console.log('');

  // Test 2: Full record population
  console.log('📋 Test 2: Full Record Population');
  for (const testCase of testRecords) {
    console.log(`   ${testCase.name}:`);

    const recordCopy = JSON.parse(JSON.stringify(testCase.record));

    await SafeTeamPopulation.populateTeamsInHistoryRecord(
      mockTeamRepository,
      recordCopy,
    );

    // Verificar resultados
    let populationSuccess = false;

    if (
      recordCopy.itemType === 'members' &&
      recordCopy.actionType === 'bulk-create'
    ) {
      const members = recordCopy.changes?.newData;
      if (Array.isArray(members)) {
        const populatedCount = members.filter(
          (m) => m.team && typeof m.team === 'object',
        ).length;
        console.log(
          `     Populated ${populatedCount}/${members.length} members`,
        );
        populationSuccess = populatedCount > 0;
      }
    } else if (
      recordCopy.changes?.newData?.team ||
      recordCopy.changes?.oldData?.team
    ) {
      const newTeamPopulated =
        recordCopy.changes?.newData?.team &&
        typeof recordCopy.changes.newData.team === 'object';
      const oldTeamPopulated =
        recordCopy.changes?.oldData?.team &&
        typeof recordCopy.changes.oldData.team === 'object';
      populationSuccess = newTeamPopulated || oldTeamPopulated;
      console.log(`     New team populated: ${newTeamPopulated ? '✅' : '❌'}`);
      console.log(`     Old team populated: ${oldTeamPopulated ? '✅' : '❌'}`);
    } else {
      console.log(`     No teams to populate (expected)`);
      populationSuccess = true; // Expected behavior
    }

    if (populationSuccess) {
      console.log(`     ✅ PASSED`);
      passed++;
    } else {
      console.log(`     ❌ FAILED`);
      failed++;
    }
  }

  console.log('');

  // Test 3: Population statistics
  console.log('📋 Test 3: Population Statistics');
  const stats = await SafeTeamPopulation.getPopulationStats(
    mockTeamRepository,
    testRecords.map((tc) => tc.record),
  );

  console.log(`   Total records: ${stats.totalRecords}`);
  console.log(`   Records with teams: ${stats.recordsWithTeams}`);
  console.log(`   Successful populations: ${stats.successfulPopulations}`);
  console.log(`   Failed populations: ${stats.failedPopulations}`);
  console.log(`   Invalid ObjectIds: ${stats.invalidObjectIds}`);
  console.log(`   Teams not found: ${stats.teamsNotFound}`);

  if (stats.totalRecords === testRecords.length) {
    console.log(`   ✅ Statistics test PASSED`);
    passed++;
  } else {
    console.log(`   ❌ Statistics test FAILED`);
    failed++;
  }

  console.log('');
  console.log(`🎯 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log(
      '🎉 All tests passed! Safe Team Population is working correctly.',
    );
  } else {
    console.log('⚠️  Some tests failed. Review the population logic.');
  }
}

// Uncomment to run the test
// testSafeTeamPopulation();

// Export for integration tests (already exported above)
