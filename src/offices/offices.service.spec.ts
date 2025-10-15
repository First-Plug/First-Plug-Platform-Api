import { Test, TestingModule } from '@nestjs/testing';
import { OfficesService } from './offices.service';
import { TenantModelRegistry } from '../infra/db/tenant-model-registry';
import { HistoryService } from '../history/history.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsGateway } from '../infra/event-bus/events.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('OfficesService', () => {
  let service: OfficesService;
  let mockTenantModelRegistry: jest.Mocked<TenantModelRegistry>;
  let mockHistoryService: jest.Mocked<HistoryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockEventsGateway: jest.Mocked<EventsGateway>;
  let mockOfficeModel: any;

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
    isDeleted: false,
    save: jest.fn(),
    toObject: jest.fn(),
  };

  beforeEach(async () => {
    mockOfficeModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockTenantModelRegistry = {
      getOfficeModel: jest.fn().mockResolvedValue(mockOfficeModel),
    } as any;

    mockHistoryService = {
      recordOfficeHistory: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    mockEventsGateway = {
      notifyTenant: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfficesService,
        {
          provide: TenantModelRegistry,
          useValue: mockTenantModelRegistry,
        },
        {
          provide: HistoryService,
          useValue: mockHistoryService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
      ],
    }).compile();

    service = module.get<OfficesService>(OfficesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByTenantName', () => {
    it('should return offices sorted by default first', async () => {
      const offices = [
        { ...mockOffice, isDefault: false, name: 'Office B' },
        { ...mockOffice, isDefault: true, name: 'Office A' },
      ];
      
      mockOfficeModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(offices),
      });

      const result = await service.findAllByTenantName('test-tenant');

      expect(mockOfficeModel.find).toHaveBeenCalledWith({
        isDeleted: false,
      });
      expect(result).toEqual(offices);
    });
  });

  describe('createOffice', () => {
    it('should create office and set as default if no other default exists', async () => {
      const createDto = {
        name: 'New Office',
        email: 'new@office.com',
        phone: '+1234567890',
        country: 'US',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        address: '456 New St',
      };

      mockOfficeModel.findOne.mockResolvedValue(null); // No default office exists
      mockOfficeModel.create.mockResolvedValue([mockOffice]);

      const result = await service.createOffice(createDto, 'test-tenant', 'user-id');

      expect(mockOfficeModel.findOne).toHaveBeenCalledWith({
        isDefault: true,
        isDeleted: false,
      });
      expect(mockOfficeModel.create).toHaveBeenCalledWith([
        expect.objectContaining({
          ...createDto,
          isDefault: true, // Should be set as default
        }),
      ]);
      expect(result).toEqual(mockOffice);
    });

    it('should create office as non-default if default already exists', async () => {
      const createDto = {
        name: 'New Office',
        email: 'new@office.com',
        isDefault: true, // User wants it as default
      };

      mockOfficeModel.findOne.mockResolvedValue(mockOffice); // Default office exists
      mockOfficeModel.create.mockResolvedValue([{ ...mockOffice, isDefault: false }]);

      const result = await service.createOffice(createDto, 'test-tenant', 'user-id');

      expect(mockOfficeModel.create).toHaveBeenCalledWith([
        expect.objectContaining({
          isDefault: false, // Should override user's request
        }),
      ]);
    });
  });

  describe('toggleDefaultOffice', () => {
    it('should toggle office to default and unmark others', async () => {
      const officeId = new Types.ObjectId();
      
      mockOfficeModel.findOne.mockResolvedValue(mockOffice);
      mockOfficeModel.updateMany.mockResolvedValue({ modifiedCount: 1 });
      mockOfficeModel.findByIdAndUpdate.mockResolvedValue({
        ...mockOffice,
        isDefault: true,
      });

      const result = await service.toggleDefaultOffice(officeId, 'test-tenant', 'user-id');

      expect(mockOfficeModel.findOne).toHaveBeenCalledWith({
        _id: officeId,
        isDeleted: false,
      });
      expect(mockOfficeModel.updateMany).toHaveBeenCalledWith(
        { isDeleted: false },
        { $set: { isDefault: false } }
      );
      expect(mockOfficeModel.findByIdAndUpdate).toHaveBeenCalledWith(
        officeId,
        { $set: { isDefault: true } },
        { new: true }
      );
    });

    it('should throw NotFoundException if office not found', async () => {
      const officeId = new Types.ObjectId();
      mockOfficeModel.findOne.mockResolvedValue(null);

      await expect(
        service.toggleDefaultOffice(officeId, 'test-tenant', 'user-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteOffice', () => {
    it('should soft delete non-default office', async () => {
      const officeId = new Types.ObjectId();
      const nonDefaultOffice = { ...mockOffice, isDefault: false };
      
      mockOfficeModel.findOne.mockResolvedValue(nonDefaultOffice);
      mockOfficeModel.findByIdAndUpdate.mockResolvedValue({
        ...nonDefaultOffice,
        isDeleted: true,
      });

      const result = await service.softDeleteOffice(officeId, 'test-tenant', 'user-id');

      expect(mockOfficeModel.findByIdAndUpdate).toHaveBeenCalledWith(
        officeId,
        { $set: { isDeleted: true } },
        { new: true }
      );
    });

    it('should throw BadRequestException when trying to delete default office', async () => {
      const officeId = new Types.ObjectId();
      mockOfficeModel.findOne.mockResolvedValue(mockOffice); // isDefault: true

      await expect(
        service.softDeleteOffice(officeId, 'test-tenant', 'user-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDefaultOffice', () => {
    it('should return default office for tenant', async () => {
      mockOfficeModel.findOne.mockResolvedValue(mockOffice);

      const result = await service.getDefaultOffice('test-tenant');

      expect(mockOfficeModel.findOne).toHaveBeenCalledWith({
        isDefault: true,
        isDeleted: false,
      });
      expect(result).toEqual(mockOffice);
    });

    it('should return null if no default office found', async () => {
      mockOfficeModel.findOne.mockResolvedValue(null);

      const result = await service.getDefaultOffice('test-tenant');

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndTenant', () => {
    it('should return office if found and belongs to tenant', async () => {
      const officeId = new Types.ObjectId();
      mockOfficeModel.findOne.mockResolvedValue(mockOffice);

      const result = await service.findByIdAndTenant(officeId, 'test-tenant');

      expect(mockOfficeModel.findOne).toHaveBeenCalledWith({
        _id: officeId,
        isDeleted: false,
      });
      expect(result).toEqual(mockOffice);
    });

    it('should throw NotFoundException if office not found', async () => {
      const officeId = new Types.ObjectId();
      mockOfficeModel.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdAndTenant(officeId, 'test-tenant')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOffice', () => {
    it('should update office and emit address change event if address changed', async () => {
      const officeId = new Types.ObjectId();
      const updateDto = {
        name: 'Updated Office',
        address: '789 Updated St', // Address change
      };

      const existingOffice = {
        ...mockOffice,
        address: '123 Old St',
        save: jest.fn().mockResolvedValue(true),
      };

      mockOfficeModel.findOne.mockResolvedValue(existingOffice);

      await service.updateOffice(officeId, updateDto, 'test-tenant', 'user-id');

      expect(existingOffice.save).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'office.address.updated',
        expect.objectContaining({
          tenantName: 'test-tenant',
          officeId: officeId.toString(),
        })
      );
    });

    it('should not emit event if no address changes', async () => {
      const officeId = new Types.ObjectId();
      const updateDto = {
        name: 'Updated Office', // Only name change
      };

      const existingOffice = {
        ...mockOffice,
        save: jest.fn().mockResolvedValue(true),
      };

      mockOfficeModel.findOne.mockResolvedValue(existingOffice);

      await service.updateOffice(officeId, updateDto, 'test-tenant', 'user-id');

      expect(existingOffice.save).toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
