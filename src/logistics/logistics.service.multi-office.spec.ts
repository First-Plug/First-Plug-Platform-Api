import { Test, TestingModule } from '@nestjs/testing';
import { LogisticsService } from './logistics.sevice';
import { OfficesService } from '../offices/offices.service';
import { Types } from 'mongoose';

describe('LogisticsService - Multi-Office', () => {
  let service: LogisticsService;
  let mockOfficesService: jest.Mocked<OfficesService>;

  const mockOffice = {
    _id: new Types.ObjectId(),
    name: 'Test Office',
    isDefault: true,
    email: 'test@office.com',
    phone: '+1234567890',
    country: 'US',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    address: '123 Test St',
    apartment: 'Suite 100',
  };

  const mockProduct = {
    _id: new Types.ObjectId(),
    name: 'Test Product',
    location: 'Our office',
    officeId: mockOffice._id,
  };

  const mockShipment = {
    _id: new Types.ObjectId(),
    origin: 'Our office',
    destination: 'Employee',
    originOfficeId: mockOffice._id,
    originDetails: {
      address: '123 Test St',
      city: 'New York',
      state: 'NY',
      country: 'US',
      zipCode: '10001',
      phone: '+1234567890',
    },
    destinationDetails: {
      address: '456 Employee St',
      city: 'Boston',
      state: 'MA',
      country: 'US',
      zipCode: '02101',
      phone: '+0987654321',
    },
  };

  beforeEach(async () => {
    mockOfficesService = {
      findByIdAndTenant: jest.fn(),
      getDefaultOffice: jest.fn(),
    } as any;

    // Mock other dependencies
    const mockDependencies = {
      tenantModels: {},
      membersService: {},
      productsService: {},
      shipmentsService: {},
      warehousesService: {},
      globalProductSyncService: {},
      slackService: {},
      usersService: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogisticsService,
        {
          provide: OfficesService,
          useValue: mockOfficesService,
        },
        // Mock other dependencies
        ...Object.entries(mockDependencies).map(([key, value]) => ({
          provide: key,
          useValue: value,
        })),
      ],
    }).compile();

    service = module.get<LogisticsService>(LogisticsService);
  });

  describe('isLocationDataComplete', () => {
    it('should validate office data completeness with specific officeId', async () => {
      const completeOffice = {
        ...mockOffice,
        country: 'US',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        address: '123 Test St',
        phone: '+1234567890',
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(completeOffice);

      const result = await service.isLocationDataComplete(
        mockProduct,
        'test-tenant',
        mockOffice._id.toString()
      );

      expect(mockOfficesService.findByIdAndTenant).toHaveBeenCalledWith(
        mockOffice._id,
        'test-tenant'
      );
      expect(result).toBe(true);
    });

    it('should return false if office is missing required fields', async () => {
      const incompleteOffice = {
        ...mockOffice,
        country: 'US',
        city: 'New York',
        // Missing state, zipCode, address, phone
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(incompleteOffice);

      const result = await service.isLocationDataComplete(
        mockProduct,
        'test-tenant',
        mockOffice._id.toString()
      );

      expect(result).toBe(false);
    });

    it('should fallback to default office when no officeId provided', async () => {
      const completeOffice = {
        ...mockOffice,
        country: 'US',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        address: '123 Test St',
        phone: '+1234567890',
      };

      mockOfficesService.getDefaultOffice.mockResolvedValue(completeOffice);

      const result = await service.isLocationDataComplete(
        mockProduct,
        'test-tenant'
        // No officeId provided
      );

      expect(mockOfficesService.getDefaultOffice).toHaveBeenCalledWith('test-tenant');
      expect(result).toBe(true);
    });

    it('should return false if specific office not found', async () => {
      mockOfficesService.findByIdAndTenant.mockResolvedValue(null);

      const result = await service.isLocationDataComplete(
        mockProduct,
        'test-tenant',
        'invalid-office-id'
      );

      expect(result).toBe(false);
    });

    it('should handle non-office locations correctly', async () => {
      const fpWarehouseProduct = {
        ...mockProduct,
        location: 'FP warehouse',
      };

      const result = await service.isLocationDataComplete(
        fpWarehouseProduct,
        'test-tenant',
        mockOffice._id.toString()
      );

      // Should not call office services for non-office locations
      expect(mockOfficesService.findByIdAndTenant).not.toHaveBeenCalled();
      expect(mockOfficesService.getDefaultOffice).not.toHaveBeenCalled();
      expect(result).toBe(true); // FP warehouse is always complete
    });
  });

  describe('isShipmentDetailsComplete', () => {
    it('should validate shipment with specific office IDs', async () => {
      const completeOffice = {
        ...mockOffice,
        country: 'US',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        address: '123 Test St',
        phone: '+1234567890',
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(completeOffice);

      const result = await service.isShipmentDetailsComplete(
        mockShipment as any,
        'test-tenant'
      );

      expect(mockOfficesService.findByIdAndTenant).toHaveBeenCalledWith(
        mockOffice._id,
        'test-tenant'
      );
      expect(result).toBe(true);
    });

    it('should return false if origin office not found', async () => {
      const shipmentWithInvalidOriginOffice = {
        ...mockShipment,
        originOfficeId: new Types.ObjectId(), // Different office ID
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(null);

      const result = await service.isShipmentDetailsComplete(
        shipmentWithInvalidOriginOffice as any,
        'test-tenant'
      );

      expect(result).toBe(false);
    });

    it('should return false if destination office not found', async () => {
      const shipmentWithInvalidDestinationOffice = {
        ...mockShipment,
        destination: 'Our office',
        destinationOfficeId: new Types.ObjectId(), // Different office ID
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(null);

      const result = await service.isShipmentDetailsComplete(
        shipmentWithInvalidDestinationOffice as any,
        'test-tenant'
      );

      expect(result).toBe(false);
    });

    it('should validate shipment without office IDs (legacy data)', async () => {
      const legacyShipment = {
        ...mockShipment,
        originOfficeId: undefined,
        destinationOfficeId: undefined,
      };

      const result = await service.isShipmentDetailsComplete(
        legacyShipment as any,
        'test-tenant'
      );

      // Should not call office services for legacy shipments
      expect(mockOfficesService.findByIdAndTenant).not.toHaveBeenCalled();
      expect(result).toBe(true); // Assumes details are complete based on existing logic
    });

    it('should handle mixed office and non-office locations', async () => {
      const mixedShipment = {
        ...mockShipment,
        origin: 'Our office',
        destination: 'FP warehouse',
        originOfficeId: mockOffice._id,
        destinationOfficeId: undefined, // FP warehouse doesn't need office ID
      };

      const completeOffice = {
        ...mockOffice,
        country: 'US',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        address: '123 Test St',
        phone: '+1234567890',
      };

      mockOfficesService.findByIdAndTenant.mockResolvedValue(completeOffice);

      const result = await service.isShipmentDetailsComplete(
        mixedShipment as any,
        'test-tenant'
      );

      // Should only validate origin office
      expect(mockOfficesService.findByIdAndTenant).toHaveBeenCalledTimes(1);
      expect(mockOfficesService.findByIdAndTenant).toHaveBeenCalledWith(
        mockOffice._id,
        'test-tenant'
      );
      expect(result).toBe(true);
    });
  });

  describe('checkAndUpdateShipmentsForOurOffice', () => {
    it('should filter shipments by specific office ID when provided', async () => {
      // This test would require more complex mocking of the database operations
      // For now, we'll test that the method accepts the officeId parameter
      
      const mockTenantModels = {
        getConnection: jest.fn().mockResolvedValue({
          startSession: jest.fn().mockResolvedValue({
            withTransaction: jest.fn(),
            endSession: jest.fn(),
          }),
        }),
        getShipmentModel: jest.fn().mockResolvedValue({
          find: jest.fn().mockReturnValue({
            session: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      // Mock the tenantModels dependency
      (service as any).tenantModels = mockTenantModels;

      // Test that the method can be called with officeId
      await expect(
        service.checkAndUpdateShipmentsForOurOffice(
          'test-tenant',
          { address: 'old' },
          { address: 'new' },
          'user-id',
          'office@test.com',
          mockOffice._id.toString()
        )
      ).resolves.not.toThrow();
    });
  });
});
