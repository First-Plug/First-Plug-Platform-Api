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
import { EventsGateway } from 'src/infra/event-bus/events.gateway';
import { GlobalProductSyncService } from '../products/services/global-product-sync.service';
import { ACTIVE_SHIPMENT_STATUSES } from '../shipments/interface/shipment.interface';

@Injectable()
export class OfficesService {
  constructor(
    private readonly eventsGateway: EventsGateway,
    @Inject('OFFICE_MODEL')
    private officeModel: Model<Office>,
    private eventEmitter: EventEmitter2,
    private tenantModelRegistry: TenantModelRegistry,
    @Optional() private historyService?: HistoryService,
    @Optional() private globalProductSyncService?: GlobalProductSyncService,
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
      updateData,
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

      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          tenantName,
          emptyAddress,
          newAddress,
          new Date(),
          userId,
          currentOffice.email,
          currentOffice._id.toString(),
          currentOffice.name,
          currentOffice.isDefault,
        ),
      );

      return currentOffice;
    }

    // Validar que el nombre no se repita en el tenant (case-insensitive) si se está actualizando el nombre
    if (updateData.name && updateData.name !== currentOffice.name) {
      const existingOfficeWithName = await OfficeModel.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        _id: { $ne: currentOffice._id },
        isDeleted: false,
      });

      if (existingOfficeWithName) {
        throw new BadRequestException(
          `Ya existe una oficina con el nombre "${updateData.name}" en este tenant`,
        );
      }
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

    // 🔧 Usar $set para asegurar que strings vacíos se actualicen correctamente

    const updatedOffice = await OfficeModel.findByIdAndUpdate(
      currentOffice._id,
      { $set: updateData },
      { new: true },
    );

    if (!updatedOffice) {
      throw new NotFoundException('Error actualizando oficina');
    }

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

    // Detectar cambios en el nombre de la oficina
    const hasNameChange = currentOffice.name !== updatedOffice.name;

    if (hasAddressChanges || hasNameChange) {
      if (hasAddressChanges) {
        console.log('📍 Dirección de oficina actualizada, emitiendo evento');
      }
      if (hasNameChange) {
        console.log(
          `📝 Nombre de oficina actualizado: "${currentOffice.name}" → "${updatedOffice.name}", emitiendo evento`,
        );
      }

      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          tenantName,
          oldAddress,
          newAddress,
          new Date(),
          userId,
          updatedOffice.email,
          updatedOffice._id.toString(),
          updatedOffice.name,
          updatedOffice.isDefault,
        ),
      );
    }

    this.eventsGateway.notifyTenant('superadmin', 'superadmin', {
      company: updatedOffice,
      office: updatedOffice,
    });

    return updatedOffice;
  }

  async getDefaultOffice(tenantName: string): Promise<Office | null> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    // La oficina "Main Office" ya debería existir gracias a TenantModelRegistry
    const office = await OfficeModel.findOne({
      isDefault: true,
      isDeleted: false,
    });

    return office;
  }

  /**
   * Obtiene el email de la oficina default para un tenant
   */
  async getDefaultOfficeEmail(tenantName: string): Promise<string | null> {
    const office = await this.getDefaultOffice(tenantName);
    return office?.email || null;
  }

  /**
   * Crear nueva oficina para un tenant específico
   */
  async createOffice(
    tenantName: string,
    tenantId: Types.ObjectId,
    createOfficeDto: CreateOfficeDto,
    userId: string,
  ): Promise<Office> {
    console.log('🏢 Creando nueva oficina:', {
      tenantName,
      officeName: createOfficeDto.name,
      userId,
    });

    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    // Validar que el nombre no se repita en el tenant (case-insensitive)
    const existingOfficeWithName = await OfficeModel.findOne({
      name: { $regex: new RegExp(`^${createOfficeDto.name}$`, 'i') },
      isDeleted: false,
    });

    if (existingOfficeWithName) {
      throw new BadRequestException(
        `Ya existe una oficina con el nombre "${createOfficeDto.name}" en este tenant`,
      );
    }

    // Si se marca como default, desmarcar las demás
    if (createOfficeDto.isDefault) {
      await OfficeModel.updateMany(
        { isDeleted: false },
        { $set: { isDefault: false } },
      );
    }

    const officeData = {
      ...createOfficeDto,
      tenantId,
      isDeleted: false,
    };

    const office = await OfficeModel.create(officeData);

    console.log('✅ Oficina creada:', {
      tenantName,
      officeId: office._id,
      name: office.name,
      isDefault: office.isDefault,
    });

    // Crear registro de history
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

    return office;
  }

  /**
   * Obtener todas las oficinas de un tenant por nombre
   */
  async findAllByTenantName(tenantName: string): Promise<Office[]> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    return OfficeModel.find({ isDeleted: false }).sort({
      isDefault: -1,
      name: 1,
    });
  }

  /**
   * Obtener oficina por ID y validar que pertenece al tenant
   */
  async findByIdAndTenant(
    id: Types.ObjectId,
    tenantName: string,
  ): Promise<Office | null> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    return OfficeModel.findOne({ _id: id, isDeleted: false });
  }

  /**
   * Actualizar oficina específica
   */
  async updateOffice(
    id: Types.ObjectId,
    tenantName: string,
    updateOfficeDto: UpdateOfficeDto,
    userId: string,
  ): Promise<Office> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const office = await OfficeModel.findOne({ _id: id, isDeleted: false });
    if (!office) throw new NotFoundException('Office not found');

    // 🚫 VALIDACIÓN: No permitir edición si hay shipments "On The Way"
    const hasOnTheWayShipments = await this.hasOnTheWayShipments(
      id,
      tenantName,
    );

    if (hasOnTheWayShipments) {
      throw new BadRequestException(
        'No se puede editar la oficina porque tiene envíos en tránsito. Espere a que los envíos se completen antes de realizar cambios.',
      );
    }

    // 🚫 VALIDACIÓN: No permitir cambiar country si se está intentando
    if (updateOfficeDto.country && updateOfficeDto.country !== office.country) {
      throw new BadRequestException(
        'No se puede cambiar el país de la oficina. Este campo no es editable.',
      );
    }

    // Validar que el nombre no se repita en el tenant (case-insensitive) si se está actualizando el nombre
    if (updateOfficeDto.name && updateOfficeDto.name !== office.name) {
      const existingOfficeWithName = await OfficeModel.findOne({
        name: { $regex: new RegExp(`^${updateOfficeDto.name}$`, 'i') },
        _id: { $ne: id },
        isDeleted: false,
      });

      if (existingOfficeWithName) {
        throw new BadRequestException(
          `Ya existe una oficina con el nombre "${updateOfficeDto.name}" en este tenant`,
        );
      }
    }

    // Si se marca como default, desmarcar las demás
    if (updateOfficeDto.isDefault) {
      await OfficeModel.updateMany(
        { _id: { $ne: id }, isDeleted: false },
        { $set: { isDefault: false } },
      );
    }

    const oldAddress = {
      address: office.address,
      apartment: office.apartment,
      city: office.city,
      state: office.state,
      country: office.country,
      zipCode: office.zipCode,
      phone: office.phone,
      ourOfficeEmail: office.email,
    };

    const updated = await OfficeModel.findByIdAndUpdate(
      id,
      { $set: updateOfficeDto },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Office not found');
    }

    // Crear registro de history
    if (this.historyService) {
      try {
        await this.historyService.create({
          actionType: 'update',
          itemType: 'offices',
          userId,
          changes: {
            oldData: office.toObject(),
            newData: updated.toObject(),
            context: 'office-address-update',
          },
        });
      } catch (error) {
        console.error('❌ Error creando history de oficina:', error);
      }
    }

    const newAddress = {
      address: updated.address,
      apartment: updated.apartment,
      city: updated.city,
      state: updated.state,
      country: updated.country,
      zipCode: updated.zipCode,
      phone: updated.phone,
      ourOfficeEmail: updated.email,
    };

    const hasAddressChanges = Object.keys(oldAddress).some(
      (key) => oldAddress[key] !== newAddress[key],
    );

    // Detectar cambios en el nombre de la oficina
    const hasNameChange = office.name !== updated.name;

    if (hasAddressChanges || hasNameChange) {
      if (hasAddressChanges) {
        console.log('📍 Dirección de oficina actualizada, emitiendo evento');
      }
      if (hasNameChange) {
        console.log(
          `📝 Nombre de oficina actualizado: "${office.name}" → "${updated.name}", emitiendo evento`,
        );
      }

      this.eventEmitter.emit(
        EventTypes.OFFICE_ADDRESS_UPDATED,
        new OfficeAddressUpdatedEvent(
          tenantName,
          oldAddress,
          newAddress,
          new Date(),
          userId,
          updated.email,
          updated._id.toString(),
          updated.name,
          updated.isDefault,
        ),
      );
    }

    this.eventsGateway.notifyTenant('superadmin', 'superadmin', {
      office: updated,
    });

    // 🔄 PROPAGACIÓN: Si cambió el name, propagar a productos
    if (updateOfficeDto.name && updateOfficeDto.name !== office.name) {
      try {
        console.log(
          `🔄 [UPDATE_OFFICE] Propagando cambio de nombre de oficina`,
        );
        await this.propagateOfficeNameChange(
          id.toString(),
          updateOfficeDto.name,
          tenantName,
        );
      } catch (error) {
        console.error(
          `❌ [UPDATE_OFFICE] Error en propagación de nombre:`,
          error,
        );
        // No fallar el update de oficina por error en propagación
        // El update de oficina ya se completó exitosamente
      }
    }

    return updated;
  }

  /**
   * Toggle oficina como default (desmarcar las demás)
   */
  async toggleDefaultOffice(
    id: Types.ObjectId,
    tenantName: string,
    userId: string,
  ): Promise<Office> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const office = await OfficeModel.findOne({ _id: id, isDeleted: false });
    if (!office) throw new NotFoundException('Office not found');

    // Desmarcar todas las oficinas como default
    await OfficeModel.updateMany(
      { isDeleted: false },
      { $set: { isDefault: false } },
    );

    // Marcar esta oficina como default
    const updated = await OfficeModel.findByIdAndUpdate(
      id,
      { $set: { isDefault: true } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Office not found');
    }

    console.log('✅ Oficina marcada como default:', {
      tenantName,
      officeId: updated._id,
      name: updated.name,
    });

    // Crear registro de history
    if (this.historyService) {
      try {
        await this.historyService.create({
          actionType: 'update',
          itemType: 'offices',
          userId,
          changes: {
            oldData: office.toObject(),
            newData: updated.toObject(),
            context: 'office-address-update',
          },
        });
      } catch (error) {
        console.error('❌ Error creando history de oficina:', error);
      }
    }

    return updated;
  }

  /**
   * Verificar si una oficina tiene productos asignados que sean recoverable: true
   * Solo productos recoverable: true impiden el borrado de la oficina
   */
  async hasAssignedProducts(
    officeId: Types.ObjectId,
    tenantName: string,
  ): Promise<boolean> {
    try {
      const ProductModel =
        await this.tenantModelRegistry.getProductModel(tenantName);

      const productCount = await ProductModel.countDocuments({
        $or: [{ officeId: officeId }, { 'office.officeId': officeId }],
        location: 'Our office',
        isDeleted: { $ne: true },
        recoverable: true, // ✅ Solo productos recoverable: true impiden el borrado
      });

      return productCount > 0;
    } catch (error) {
      console.error('Error checking assigned products:', error);
      return false;
    }
  }

  /**
   * Verificar si una oficina tiene shipments activos
   */
  async hasActiveShipments(
    officeId: Types.ObjectId,
    tenantName: string,
  ): Promise<boolean> {
    try {
      const ShipmentModel =
        await this.tenantModelRegistry.getShipmentModel(tenantName);

      const activeStatuses = ACTIVE_SHIPMENT_STATUSES;

      const query = {
        $or: [{ originOfficeId: officeId }, { destinationOfficeId: officeId }],
        shipment_status: { $in: activeStatuses },
        isDeleted: { $ne: true },
      };

      const shipmentCount = await ShipmentModel.countDocuments(query);

      return shipmentCount > 0;
    } catch (error) {
      console.error('Error checking active shipments:', error);
      return false;
    }
  }

  /**
   * Verificar si una oficina tiene shipments "On The Way" específicamente
   */
  async hasOnTheWayShipments(
    officeId: Types.ObjectId,
    tenantName: string,
  ): Promise<boolean> {
    try {
      const ShipmentModel =
        await this.tenantModelRegistry.getShipmentModel(tenantName);

      const shipmentCount = await ShipmentModel.countDocuments({
        $or: [{ originOfficeId: officeId }, { destinationOfficeId: officeId }],
        shipment_status: 'On The Way',
        isDeleted: { $ne: true },
      });

      return shipmentCount > 0;
    } catch (error) {
      console.error('Error checking On The Way shipments:', error);
      return false;
    }
  }

  /**
   * Actualizar el flag activeShipments para una oficina específica
   */
  async updateActiveShipmentsFlag(
    officeId: Types.ObjectId,
    tenantName: string,
  ): Promise<void> {
    try {
      const OfficeModel =
        await this.tenantModelRegistry.getOfficeModel(tenantName);

      const hasActiveShipments = await this.hasActiveShipments(
        officeId,
        tenantName,
      );

      await OfficeModel.findByIdAndUpdate(
        officeId,
        { $set: { activeShipments: hasActiveShipments } },
        { new: true },
      );

      console.log(
        `🏢 [updateActiveShipmentsFlag] Office ${officeId} activeShipments flag updated to: ${hasActiveShipments}`,
      );
    } catch (error) {
      console.error('Error updating activeShipments flag:', error);
    }
  }

  /**
   * Actualizar flags activeShipments para todas las oficinas involucradas en un shipment
   */
  async updateActiveShipmentsFlagsForShipment(
    originOfficeId: Types.ObjectId | null,
    destinationOfficeId: Types.ObjectId | null,
    tenantName: string,
  ): Promise<void> {
    try {
      const officeIds = [originOfficeId, destinationOfficeId].filter(
        (id) => id !== null,
      ) as Types.ObjectId[];

      for (const officeId of officeIds) {
        await this.updateActiveShipmentsFlag(officeId, tenantName);
      }
    } catch (error) {
      console.error(
        'Error updating activeShipments flags for shipment:',
        error,
      );
    }
  }

  /**
   * Soft delete de oficina (no se puede eliminar la default)
   */
  async softDeleteOffice(
    id: Types.ObjectId,
    tenantName: string,
    userId: string,
  ): Promise<Office> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const office = await OfficeModel.findOne({ _id: id, isDeleted: false });
    if (!office) throw new NotFoundException('Office not found');

    if (office.isDefault) {
      throw new BadRequestException(
        'Cannot delete default office. Please set another office as default first.',
      );
    }

    // Verificar si tiene productos recoverable asignados
    const hasRecoverableProducts = await this.hasAssignedProducts(
      id,
      tenantName,
    );
    if (hasRecoverableProducts) {
      throw new BadRequestException(
        'No se puede eliminar la oficina porque tiene productos recuperables asignados. Por favor, reasigne estos productos primero.',
      );
    }

    // 🗑️ SOFT DELETE: Aplicar soft delete automáticamente a productos non-recoverable
    // Delegamos esta responsabilidad al servicio transversal correspondiente
    await this.softDeleteNonRecoverableProducts(id, tenantName, userId);

    // Verificar si tiene shipments activos
    const hasShipments = await this.hasActiveShipments(id, tenantName);
    if (hasShipments) {
      throw new BadRequestException(
        'No se puede eliminar la oficina porque tiene envíos activos.',
      );
    }

    const updated = await OfficeModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isDeleted: true,
          isActive: false,
          deletedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Office not found');
    }

    console.log('🗑️ Oficina eliminada (soft delete):', {
      tenantName,
      officeId: updated._id,
      name: updated.name,
    });

    // Crear registro de history
    if (this.historyService) {
      try {
        await this.historyService.create({
          actionType: 'update',
          itemType: 'offices',
          userId,
          changes: {
            oldData: office.toObject(),
            newData: updated.toObject(),
            context: 'office-address-update',
          },
        });
      } catch (error) {
        console.error('❌ Error creando history de oficina:', error);
      }
    }

    return updated;
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
          updated._id.toString(),
          updated.name,
          updated.isDefault,
        ),
      );
    }

    this.eventsGateway.notifyTenant('superadmin', 'superadmin', {
      office: updated,
    });

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
    // Usar el método updateOffice que maneja oficinas específicas
    return await this.updateOffice(
      new Types.ObjectId(officeId),
      tenantName,
      updateData,
      userId,
    );
  }

  /**
   * Propaga el cambio de nombre de oficina a todos los productos que la referencian
   * @param officeId ID de la oficina
   * @param newOfficeName Nuevo nombre de la oficina
   * @param tenantName Nombre del tenant
   */
  private async propagateOfficeNameChange(
    officeId: string,
    newOfficeName: string,
    tenantName: string,
  ): Promise<void> {
    console.log(`🔄 [OFFICE_NAME_PROPAGATION] Iniciando propagación:`, {
      officeId,
      newOfficeName,
      tenantName,
    });

    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    const MemberModel =
      await this.tenantModelRegistry.getMemberModel(tenantName);
    const connection = ProductModel.db;

    const session = await connection.startSession();
    session.startTransaction();

    try {
      // 1. Actualizar productos en collection products
      await ProductModel.updateMany(
        { 'office.officeId': officeId },
        { $set: { 'office.officeName': newOfficeName } },
        { session },
      );

      // 2. Actualizar productos en collection members
      await MemberModel.updateMany(
        { 'products.office.officeId': officeId },
        { $set: { 'products.$[elem].office.officeName': newOfficeName } },
        {
          arrayFilters: [{ 'elem.office.officeId': officeId }],
          session,
        },
      );

      await session.commitTransaction();

      // 3. Sincronizar productos afectados a global collection (fuera de la transacción)
      await this.syncAffectedProductsToGlobal(officeId, tenantName);
    } catch (error) {
      await session.abortTransaction();

      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Sincroniza productos afectados por el cambio de nombre a la global collection
   * @param officeId ID de la oficina
   * @param tenantName Nombre del tenant
   */
  private async syncAffectedProductsToGlobal(
    officeId: string,
    tenantName: string,
  ): Promise<void> {
    if (!this.globalProductSyncService) {
      return;
    }

    const ProductModel =
      await this.tenantModelRegistry.getProductModel(tenantName);
    const MemberModel =
      await this.tenantModelRegistry.getMemberModel(tenantName);

    try {
      // 1. Sincronizar productos de products collection
      const affectedProducts = await ProductModel.find({
        'office.officeId': officeId,
      });

      for (const product of affectedProducts) {
        try {
          await this.globalProductSyncService.syncProduct({
            tenantId: tenantName,
            tenantName: tenantName,
            originalProductId: product._id as any,
            sourceCollection: 'products',
            name: product.name || '',
            category: product.category,
            status: product.status,
            location: product.location || 'Our office',
            attributes:
              product.attributes?.map((attr: any) => ({
                key: attr.key,
                value: String(attr.value),
              })) || [],
            serialNumber: product.serialNumber || undefined,
            assignedEmail: product.assignedEmail,
            assignedMember: product.assignedMember,
            lastAssigned: product.lastAssigned,
            acquisitionDate: product.acquisitionDate,
            price: product.price,
            additionalInfo: product.additionalInfo,
            productCondition: product.productCondition,
            recoverable: product.recoverable,
            fp_shipment: product.fp_shipment,
            activeShipment: product.activeShipment,
            office: product.office
              ? {
                  officeId: product.office.officeId as any,
                  officeCountryCode: product.office.officeCountryCode || '',
                  officeName: product.office.officeName || '',
                  assignedAt: product.office.assignedAt,
                  isDefault: product.office.isDefault,
                }
              : undefined,
            sourceUpdatedAt: (product as any).updatedAt || new Date(),
          });
        } catch (error) {
          console.error(
            `❌ [OFFICE_NAME_PROPAGATION] Error syncing product ${product._id}:`,
            error,
          );
        }
      }

      // 2. Sincronizar productos de members collection
      const membersWithAffectedProducts = await MemberModel.find({
        'products.office.officeId': officeId,
      });

      for (const member of membersWithAffectedProducts) {
        for (const product of member.products || []) {
          if (product.office?.officeId?.toString() === officeId) {
            try {
              await this.globalProductSyncService.syncProduct({
                tenantId: tenantName,
                tenantName: tenantName,
                originalProductId: product._id as any,
                sourceCollection: 'members',
                name: product.name || '',
                category: product.category,
                status: product.status,
                location: 'Employee',
                attributes:
                  product.attributes?.map((attr: any) => ({
                    key: attr.key,
                    value: String(attr.value),
                  })) || [],
                serialNumber: product.serialNumber || undefined,
                assignedEmail: member.email,
                assignedMember: `${member.firstName} ${member.lastName}`,
                lastAssigned: product.lastAssigned,
                acquisitionDate: product.acquisitionDate,
                price: product.price,
                additionalInfo: product.additionalInfo,
                productCondition: product.productCondition,
                recoverable: product.recoverable,
                fp_shipment: product.fp_shipment,
                activeShipment: product.activeShipment,
                office: product.office
                  ? {
                      officeId: product.office.officeId as any,
                      officeCountryCode: product.office.officeCountryCode || '',
                      officeName: product.office.officeName || '',
                      assignedAt: product.office.assignedAt,
                      isDefault: product.office.isDefault,
                    }
                  : undefined,
                memberData: {
                  memberId: member._id as any,
                  memberEmail: member.email,
                  memberName: `${member.firstName} ${member.lastName}`,
                  assignedAt: (product as any).assignedAt || new Date(),
                },
                sourceUpdatedAt: (product as any).updatedAt || new Date(),
              });
            } catch (error) {
              console.error(
                `❌ [OFFICE_NAME_PROPAGATION] Error syncing member product ${product._id}:`,
                error,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `❌ [OFFICE_NAME_PROPAGATION] Error en sincronización global:`,
        error,
      );
      // No fallar la operación principal por error en sincronización
    }
  }

  /**
   * Aplicar soft delete automáticamente a productos non-recoverable de una oficina
   * Esto se ejecuta antes de borrar la oficina para evitar productos "huérfanos"
   * NOTA: Solo marca los productos como eliminados, sin lógica compleja de negocio
   */
  private async softDeleteNonRecoverableProducts(
    officeId: Types.ObjectId,
    tenantName: string,
    userId: string,
  ): Promise<void> {
    try {
      const ProductModel =
        await this.tenantModelRegistry.getProductModel(tenantName);

      // Buscar productos non-recoverable en esta oficina
      const nonRecoverableProducts = await ProductModel.find({
        $or: [{ officeId: officeId }, { 'office.officeId': officeId }],
        location: 'Our office',
        isDeleted: { $ne: true },
        recoverable: false, // Solo productos non-recoverable
      });

      if (nonRecoverableProducts.length === 0) {
        return;
      }

      // 🗑️ SOFT DELETE DIRECTO: Actualizar cada producto individualmente para preservar serialNumber
      let modifiedCount = 0;

      for (const product of nonRecoverableProducts) {
        try {
          await ProductModel.findByIdAndUpdate(product._id, {
            $set: {
              status: 'Deprecated',
              isDeleted: true,
              deletedAt: new Date(),
              // ✅ CORRECTO: Guardar el valor real del serialNumber
              lastSerialNumber: product.serialNumber || undefined,
            },
            $unset: {
              // Limpiar serialNumber para evitar conflictos futuros
              serialNumber: 1,
            },
          });
          modifiedCount++;
        } catch (productError) {
          console.error(
            `❌ [softDeleteNonRecoverableProducts] Error deleting product ${product._id}:`,
            productError,
          );
          // Continuar con los demás productos aunque uno falle
        }
      }

      const updateResult = { modifiedCount };

      // 📝 HISTORY: Registrar la acción si el servicio está disponible
      if (this.historyService && updateResult.modifiedCount > 0) {
        try {
          await this.historyService.create({
            actionType: 'delete',
            itemType: 'assets',
            userId,
            changes: {
              oldData: null,
              newData: {
                deletedCount: updateResult.modifiedCount,
                reason: `Office ${officeId} deletion - non-recoverable products`,
                officeId: officeId.toString(),
              },
              context: 'single-product',
            },
          });
        } catch (historyError) {
          console.error(
            `⚠️ [softDeleteNonRecoverableProducts] Error creating history:`,
            historyError,
          );
          // No fallar la operación principal por error en history
        }
      }
    } catch (error) {
      console.error(
        `❌ [softDeleteNonRecoverableProducts] Error processing office ${officeId}:`,
        error,
      );
      // No lanzar error para no bloquear el borrado de la oficina
    }
  }
}
