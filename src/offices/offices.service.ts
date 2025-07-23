import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Office } from './schemas/office.schema';
import { CreateOfficeDto, UpdateOfficeDto } from 'src/offices/dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OfficeAddressUpdatedEvent } from 'src/infra/event-bus/office-address-update.event';
import { EventTypes } from 'src/infra/event-bus/types';
import { TenantModelRegistry } from '../infra/db/tenant-model-registry';

@Injectable()
export class OfficesService {
  constructor(
    @InjectModel(Office.name)
    private officeModel: Model<Office>,
    private eventEmitter: EventEmitter2,
    private tenantModelRegistry: TenantModelRegistry,
  ) {}

  /**
   * Configura la oficina default por primera vez
   * Se llama cuando el usuario completa los datos de oficina por primera vez
   */
  async setupDefaultOffice(
    tenantName: string,
    tenantId: Types.ObjectId,
    setupData: Omit<CreateOfficeDto, 'tenantId' | 'isDefault'>,
    userId: string,
  ): Promise<Office> {
    console.log('🏢 Configurando oficina default por primera vez:', {
      tenantName,
      userId,
    });

    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const existingDefault = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    if (existingDefault) {
      throw new BadRequestException(
        'Ya existe una oficina default para este tenant',
      );
    }

    const officeData = {
      ...setupData,
      tenantId,
      isDefault: true,
      name: setupData.name || 'Oficina Principal',
      isDeleted: false,
    };

    const office = await OfficeModel.create(officeData);

    console.log('✅ Oficina default creada en DB del tenant:', {
      tenantName,
      officeId: office._id,
      name: office.name,
    });

    const addressData = {
      address: office.address,
      apartment: office.apartment,
      city: office.city,
      state: office.state,
      country: office.country,
      zipCode: office.zipCode,
      phone: office.phone,
      ourOfficeEmail: office.email,
    };

    this.eventEmitter.emit(
      EventTypes.OFFICE_ADDRESS_UPDATED,
      new OfficeAddressUpdatedEvent(
        tenantName,
        {}, // oldAddress vacío (primera vez)
        addressData,
        new Date(),
        userId,
        office.email, // Email de contacto de la oficina
      ),
    );

    return office;
  }

  async updateDefaultOffice(
    tenantName: string,
    updateData: UpdateOfficeDto,
    userId: string,
  ): Promise<Office> {
    console.log('🏢 Actualizando oficina default:', {
      tenantName,
      userId,
    });

    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const currentOffice = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    if (!currentOffice) {
      throw new NotFoundException(
        'No se encontró oficina default para este tenant',
      );
    }

    const oldAddress = {
      address: currentOffice.address,
      apartment: currentOffice.apartment,
      city: currentOffice.city,
      state: currentOffice.state,
      country: currentOffice.country,
      zipCode: currentOffice.zipCode,
      phone: currentOffice.phone,
      ourOfficeEmail: currentOffice.email,
    };

    const updatedOffice = await OfficeModel.findByIdAndUpdate(
      currentOffice._id,
      updateData,
      { new: true },
    );

    if (!updatedOffice) {
      throw new NotFoundException('Error actualizando oficina');
    }

    console.log('✅ Oficina actualizada en DB del tenant:', {
      tenantName,
      officeId: updatedOffice._id,
    });

    const newAddress = {
      address: updatedOffice.address,
      apartment: updatedOffice.apartment,
      city: updatedOffice.city,
      state: updatedOffice.state,
      country: updatedOffice.country,
      zipCode: updatedOffice.zipCode,
      phone: updatedOffice.phone,
      ourOfficeEmail: updatedOffice.email,
    };

    const hasAddressChanges = Object.keys(oldAddress).some(
      (key) => oldAddress[key] !== newAddress[key],
    );

    if (hasAddressChanges) {
      console.log('📍 Dirección de oficina actualizada, emitiendo evento');
      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          tenantName,
          oldAddress,
          newAddress,
          new Date(),
          userId,
          updatedOffice.email,
        ),
      );
    }

    return updatedOffice;
  }

  async getDefaultOffice(tenantName: string): Promise<Office | null> {
    console.log('🔍 Buscando oficina default:', { tenantName });

    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const office = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    if (office) {
      console.log('✅ Oficina default encontrada:', {
        tenantName,
        officeId: office._id,
        name: office.name,
        email: office.email, // ✅ Mostrar email para debug
        hasEmail: !!office.email, // ✅ Verificar si tiene email
        address: office.address,
        city: office.city,
        country: office.country,
      });
    } else {
      console.log('❌ No se encontró oficina default:', { tenantName });
    }

    return office;
  }

  /**
   * Obtiene el email de la oficina default para un tenant
   */
  async getDefaultOfficeEmail(tenantName: string): Promise<string | null> {
    const office = await this.getDefaultOffice(tenantName);
    return office?.email || null;
  }

  async create(createOfficeDto: CreateOfficeDto): Promise<Office> {
    const office = await this.officeModel.create(createOfficeDto);
    return office;
  }

  async update(
    id: Types.ObjectId,
    updateOfficeDto: UpdateOfficeDto,
    userId: string,
  ): Promise<Office> {
    const office = await this.officeModel.findById(id);
    if (!office) throw new NotFoundException('Office not found');

    const oldAddress = {
      address: office.address,
      apartment: office.apartment,
      city: office.city,
      state: office.state,
      country: office.country,
      zipCode: office.zipCode,
      phone: office.phone,
    };

    const updated = await this.officeModel.findByIdAndUpdate(
      id,
      updateOfficeDto,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Office not found');
    }

    const hasAddressChanges = Object.keys(oldAddress).some(
      (key) => oldAddress[key] !== updateOfficeDto[key],
    );

    if (hasAddressChanges) {
      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          updated.tenantId.toString(),
          oldAddress,
          updateOfficeDto,
          new Date(),
          userId,
          updated.email,
        ),
      );
    }

    return updated;
  }

  async findAllByTenant(tenantId: Types.ObjectId): Promise<Office[]> {
    return this.officeModel.find({ tenantId, isDeleted: false });
  }

  async findDefaultOffice(tenantId: Types.ObjectId): Promise<Office | null> {
    return this.officeModel.findOne({
      tenantId,
      isDefault: true,
      isDeleted: false,
    });
  }

  async findById(id: Types.ObjectId): Promise<Office | null> {
    return this.officeModel.findById(id).where({ isDeleted: false });
  }

  async softDelete(id: Types.ObjectId): Promise<Office> {
    const office = await this.officeModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );
    if (!office) throw new NotFoundException('Office not found');
    return office;
  }
}
