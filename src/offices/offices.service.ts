import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Office } from './schemas/office.schema';
import { CreateOfficeDto, UpdateOfficeDto } from 'src/offices/dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OfficeAddressUpdatedEvent } from 'src/infra/event-bus/office-address-update.event';
import { EventTypes } from 'src/infra/event-bus/types';

@Injectable()
export class OfficesService {
  constructor(
    @InjectModel(Office.name)
    private officeModel: Model<Office>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createOfficeDto: CreateOfficeDto): Promise<Office> {
    const office = await this.officeModel.create(createOfficeDto);
    return office;
  }

  async update(
    id: Types.ObjectId,
    updateOfficeDto: UpdateOfficeDto,
    userId: string,
    ourOfficeEmail: string,
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
          ourOfficeEmail,
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
