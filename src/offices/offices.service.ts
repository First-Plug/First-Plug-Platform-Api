import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Office } from './schemas/office.schema';
import { CreateOfficeDto, UpdateOfficeDto } from 'src/offices/dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OfficeAddressUpdatedEvent } from 'src/infra/event-bus/office-address-update.event';
import { EventTypes } from 'src/infra/event-bus/types';
import { TenantModelRegistry } from '../infra/db/tenant-model-registry';
import { HistoryService } from '../history/history.service';

@Injectable()
export class OfficesService {
  constructor(
    @Inject('OFFICE_MODEL')
    private officeModel: Model<Office>,
    private eventEmitter: EventEmitter2,
    private tenantModelRegistry: TenantModelRegistry,
    @Optional() private historyService?: HistoryService,
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

    // Crear registro de history para la creación de la oficina
    if (this.historyService) {
      await this.historyService.create({
        actionType: 'create',
        itemType: 'offices',
        userId,
        changes: {
          oldData: null,
          newData: office.toObject(),
          context: 'setup-default-office',
        },
      });
    }

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
    tenantId?: string,
  ): Promise<Office> {
    console.log('🏢 Actualizando oficina default:', {
      tenantName,
      userId,
    });

    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    let currentOffice = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    if (!currentOffice) {
      // 🔧 CREAR oficina default con los datos enviados
      const newOfficeData = {
        name: updateData.name || 'Oficina Principal',
        isDefault: true,
        email: updateData.email || '',
        phone: updateData.phone || '',
        country: updateData.country || '',
        city: updateData.city || '',
        state: updateData.state || '',
        zipCode: updateData.zipCode || '',
        address: updateData.address || '',
        apartment: updateData.apartment || '',
        tenantId: tenantId || userId,
        isActive: true,
        isDeleted: false,
      };

      currentOffice = await OfficeModel.create(newOfficeData);

      // Para oficina nueva, no hay dirección anterior
      const emptyAddress = {
        address: '',
        apartment: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        phone: '',
        ourOfficeEmail: '',
      };

      const newAddress = {
        address: currentOffice.address,
        apartment: currentOffice.apartment,
        city: currentOffice.city,
        state: currentOffice.state,
        country: currentOffice.country,
        zipCode: currentOffice.zipCode,
        phone: currentOffice.phone,
        ourOfficeEmail: currentOffice.email,
      };

      // Emitir evento para oficina nueva
      console.log('📍 Oficina nueva creada, emitiendo evento');
      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          tenantName,
          emptyAddress,
          newAddress,
          new Date(),
          userId,
          currentOffice.email,
        ),
      );

      return currentOffice;
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

    // Crear registro de history para la actualización de la oficina
    if (this.historyService) {
      try {
        await this.historyService.create({
          actionType: 'update',
          itemType: 'offices',
          userId,
          changes: {
            oldData: currentOffice.toObject(),
            newData: updatedOffice.toObject(),
            context: 'office-address-update',
          },
        });
        console.log('✅ Registro de history de oficina creado');
      } catch (error) {
        console.error('❌ Error creando history de oficina:', error);
      }
    } else {
      console.log(
        '⚠️ HistoryService no disponible - saltando creación de history',
      );
    }

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

  // ==================== SUPERADMIN METHODS ====================

  /**
   * Obtener oficinas por tenant (para SuperAdmin)
   */
  async findOfficesByTenant(tenantName: string): Promise<Office[]> {
    const officeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);
    if (!officeModel) {
      throw new NotFoundException(`Tenant ${tenantName} not found`);
    }

    const offices = await officeModel.find({ isDeleted: { $ne: true } }).exec();

    return offices;
  }

  /**
   * Obtener todas las oficinas de tenants específicos (para SuperAdmin)
   */
  async findAllOffices(
    tenantNames: string[],
  ): Promise<{ tenantName: string; offices: Office[] }[]> {
    console.log('🏢 SuperAdmin: Obteniendo todas las oficinas cross-tenant');

    const result: { tenantName: string; offices: Office[] }[] = [];

    for (const tenantName of tenantNames) {
      try {
        const offices = await this.findOfficesByTenant(tenantName);
        result.push({ tenantName, offices });
      } catch (error) {
        console.warn(
          `⚠️ Error obteniendo oficinas de ${tenantName}:`,
          error.message,
        );
        // Continuar con otros tenants aunque uno falle
      }
    }

    console.log('✅ Oficinas cross-tenant obtenidas:', {
      tenantsCount: result.length,
      totalOffices: result.reduce((sum, t) => sum + t.offices.length, 0),
    });

    return result;
  }

  /**
   * Actualizar oficina cross-tenant (para SuperAdmin)
   */
  async updateOfficeCrossTenant(
    tenantName: string,
    officeId: string,
    updateData: UpdateOfficeDto,
    userId: string,
  ): Promise<Office> {
    console.log('🏢 SuperAdmin: Actualizando oficina cross-tenant:', {
      tenantName,
      officeId,
      userId,
    });

    // Usar el método existente que ya maneja eventos y history
    return await this.updateDefaultOffice(tenantName, updateData, userId);
  }
}
