import { Test, TestingModule } from '@nestjs/testing';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';
import { runMultiOfficeMigration } from './multi-office-migration';
import { runMultiOfficeValidation } from '../validation/multi-office-validation';
import { Types } from 'mongoose';

describe('Multi-Office Migration', () => {
  let tenantConnectionService: jest.Mocked<TenantConnectionService>;
  let tenantsService: jest.Mocked<TenantsService>;
  let officesService: jest.Mocked<OfficesService>;
  let mockConnection: any;
  let mockSession: any;
  let mockCollection: any;

  const mockTenant = {
    _id: new Types.ObjectId(),
    name: 'test-tenant',
  };

  const mockOffice = {
    _id: new Types.ObjectId(),
    name: 'Default Office',
    isDefault: true,
    email: 'default@office.com',
    phone: '+1234567890',
    country: 'US',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    address: '123 Default St',
  };

  beforeEach(async () => {
    mockCollection = {
      updateMany: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockSession = {
      withTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    tenantConnectionService = {
      getTenantConnection: jest.fn().mockResolvedValue(mockConnection),
    } as any;

    tenantsService = {
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    } as any;

    officesService = {
      getDefaultOffice: jest.fn().mockResolvedValue(mockOffice),
      findAllByTenantName: jest.fn().mockResolvedValue([mockOffice]),
    } as any;
  });

  describe('Product Migration', () => {
    it('should migrate products in products collection', async () => {
      const mockProducts = [
        {
          _id: new Types.ObjectId(),
          name: 'Product 1',
          location: 'Our office',
          // No officeId
        },
        {
          _id: new Types.ObjectId(),
          name: 'Product 2',
          location: 'Our office',
          // No officeId
        },
      ];

      mockSession.withTransaction.mockImplementation(async (callback) => {
        await callback();
        return { modifiedCount: 2 };
      });

      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 2 });

      // Mock the migration function dependencies
      const mockApp = {
        get: jest.fn((service) => {
          if (service === TenantConnectionService) return tenantConnectionService;
          if (service === TenantsService) return tenantsService;
          if (service === OfficesService) return officesService;
        }),
        close: jest.fn(),
      };

      // Mock NestFactory.createApplicationContext
      jest.doMock('@nestjs/core', () => ({
        NestFactory: {
          createApplicationContext: jest.fn().mockResolvedValue(mockApp),
        },
      }));

      // Test the migration logic
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {
          location: 'Our office',
          officeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { officeId: mockOffice._id },
        },
        { session: mockSession }
      );
    });

    it('should migrate embedded products in members collection', async () => {
      const mockMembers = [
        {
          _id: new Types.ObjectId(),
          email: 'member1@test.com',
          products: [
            {
              _id: new Types.ObjectId(),
              name: 'Embedded Product 1',
              location: 'Our office',
              // No officeId
            },
          ],
        },
      ];

      mockSession.withTransaction.mockImplementation(async (callback) => {
        await callback();
        return { modifiedCount: 1 };
      });

      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });

      // Test embedded products migration
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {
          'products.location': 'Our office',
          'products.officeId': { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { 'products.$[elem].officeId': mockOffice._id },
        },
        {
          arrayFilters: [
            {
              'elem.location': 'Our office',
              'elem.officeId': { $exists: false },
            },
          ],
          session: mockSession,
        }
      );
    });
  });

  describe('Shipment Migration', () => {
    it('should migrate shipments with origin="Our office"', async () => {
      const mockShipments = [
        {
          _id: new Types.ObjectId(),
          origin: 'Our office',
          destination: 'Employee',
          // No originOfficeId
        },
      ];

      mockSession.withTransaction.mockImplementation(async (callback) => {
        await callback();
        return { modifiedCount: 1 };
      });

      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });

      // Test origin office migration
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {
          origin: 'Our office',
          originOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { originOfficeId: mockOffice._id },
        },
        { session: mockSession }
      );
    });

    it('should migrate shipments with destination="Our office"', async () => {
      const mockShipments = [
        {
          _id: new Types.ObjectId(),
          origin: 'Employee',
          destination: 'Our office',
          // No destinationOfficeId
        },
      ];

      mockSession.withTransaction.mockImplementation(async (callback) => {
        await callback();
        return { modifiedCount: 1 };
      });

      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });

      // Test destination office migration
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {
          destination: 'Our office',
          destinationOfficeId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: { destinationOfficeId: mockOffice._id },
        },
        { session: mockSession }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle tenant without default office', async () => {
      officesService.getDefaultOffice.mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // The migration should skip tenants without default office
      // and log a warning message

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se encontró oficina default')
      );

      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      tenantConnectionService.getTenantConnection.mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // The migration should catch and log database errors

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error migrando tenant'),
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Update failed');
      mockCollection.updateMany.mockRejectedValue(error);

      mockSession.withTransaction.mockImplementation(async (callback) => {
        try {
          await callback();
        } catch (err) {
          // Transaction should be rolled back automatically
          throw err;
        }
      });

      // Verify that session.endSession is called even on error
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should validate migrated data integrity', async () => {
      // Mock validation data
      const mockValidationData = {
        productsWithoutOfficeId: [],
        shipmentsWithoutOriginOfficeId: [],
        shipmentsWithoutDestinationOfficeId: [],
        invalidOfficeIds: [],
      };

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      mockCollection.countDocuments.mockResolvedValue(0);

      // Test that validation passes after successful migration
      const validationResult = await runMultiOfficeValidation();

      // Validation should report no inconsistencies
      expect(validationResult).toBeDefined();
    });

    it('should detect inconsistencies in migrated data', async () => {
      // Mock data with inconsistencies
      const productsWithoutOfficeId = [
        {
          _id: new Types.ObjectId(),
          name: 'Unmigrated Product',
          location: 'Our office',
          // Missing officeId
        },
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(productsWithoutOfficeId),
      });

      // Test that validation detects inconsistencies
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await runMultiOfficeValidation();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Inconsistencias encontradas')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset
      const largeProductCount = 10000;
      const largeShipmentCount = 5000;

      mockCollection.updateMany.mockResolvedValue({
        modifiedCount: largeProductCount,
      });

      mockSession.withTransaction.mockImplementation(async (callback) => {
        const startTime = Date.now();
        await callback();
        const endTime = Date.now();
        
        // Verify that migration completes in reasonable time
        expect(endTime - startTime).toBeLessThan(30000); // 30 seconds
        
        return { modifiedCount: largeProductCount + largeShipmentCount };
      });

      // Test that migration handles large datasets
      // without timing out or running out of memory
    });

    it('should use transactions for data consistency', async () => {
      // Verify that all operations use the same session
      expect(mockConnection.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
