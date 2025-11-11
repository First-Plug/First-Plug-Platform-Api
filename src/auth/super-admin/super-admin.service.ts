import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Tenant } from '../../tenants/schemas/tenant.schema';
import { TenantConnectionService } from '../../infra/db/tenant-connection.service';
import { ShipmentDocument } from '../../shipments/schema/shipment.schema';
import { Office } from '../../offices/schemas/office.schema';
import { TenantModelRegistry } from '../../infra/db/tenant-model-registry';

type TenantDocument = Tenant & Document;
type OfficeDocument = Office & Document;

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private tenantConnectionService: TenantConnectionService,
    private tenantModelRegistry: TenantModelRegistry,
  ) {}

  /**
   * Obtiene todos los usuarios del sistema
   */
  async getAllUsers(): Promise<UserDocument[]> {
    return this.userModel
      .find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtiene usuarios que no tienen tenant asignado
   */
  async getUsersWithoutTenant(): Promise<UserDocument[]> {
    return this.userModel
      .find({
        tenantId: { $exists: false },
        tenantName: { $exists: false },
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtiene todos los tenants del sistema
   */
  async getAllTenants(): Promise<TenantDocument[]> {
    return this.tenantModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Asigna un tenant a un usuario
   */
  async assignTenantToUser(
    userId: string,
    tenantId: string,
  ): Promise<UserDocument> {
    try {
      // Validar formato de IDs
      if (!Types.ObjectId.isValid(userId)) {
        throw new NotFoundException(`ID de usuario inválido: ${userId}`);
      }
      if (!Types.ObjectId.isValid(tenantId)) {
        throw new NotFoundException(`ID de tenant inválido: ${tenantId}`);
      }

      // Verificar que el tenant existe y está activo
      const tenant = await this.tenantModel.findOne({
        _id: tenantId,
        isActive: true,
      });
      if (!tenant) {
        throw new NotFoundException(
          `Tenant con ID ${tenantId} no encontrado o inactivo`,
        );
      }

      // Verificar que el usuario existe y no está eliminado
      const user = await this.userModel.findOne({
        _id: userId,
        isDeleted: { $ne: true },
      });
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      // Verificar que el usuario no tiene ya un tenant asignado
      if (user.tenantId) {
        throw new Error(`Usuario ${user.email} ya tiene un tenant asignado`);
      }

      // Asignar tenant y activar usuario
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        {
          tenantId: new Types.ObjectId(tenantId),
          status: 'active',
        },
        { new: true },
      );

      if (!updatedUser) {
        throw new Error('Error actualizando usuario');
      }

      return updatedUser;
    } catch (error) {
      this.logger.error(`❌ Error asignando tenant a usuario:`, error.message);
      throw error;
    }
  }

  /**
   * Actualiza información de un tenant
   */
  async updateTenant(
    tenantId: string,
    updateData: Partial<Tenant>,
  ): Promise<TenantDocument> {
    const updatedTenant = await this.tenantModel.findByIdAndUpdate(
      tenantId,
      updateData,
      { new: true },
    );

    if (!updatedTenant) {
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado`);
    }

    return updatedTenant;
  }

  /**
   * Obtiene la oficina por defecto de un tenant
   */
  async getTenantDefaultOffice(
    tenantName: string,
  ): Promise<OfficeDocument | null> {
    try {
      const OfficeModel =
        await this.tenantModelRegistry.getOfficeModel(tenantName);
      return OfficeModel.findOne({ isDefault: true });
    } catch (error) {
      return null;
    }
  }

  /**
   * Actualiza la oficina por defecto de un tenant
   */
  async updateTenantOffice(
    tenantName: string,
    officeId: string,
    updateData: Partial<OfficeDocument>,
  ): Promise<OfficeDocument> {
    const OfficeModel =
      await this.tenantModelRegistry.getOfficeModel(tenantName);

    const updatedOffice = await OfficeModel.findByIdAndUpdate(
      officeId,
      updateData,
      { new: true },
    );

    if (!updatedOffice) {
      throw new NotFoundException(
        `Oficina con ID ${officeId} no encontrada en tenant ${tenantName}`,
      );
    }

    return updatedOffice;
  }

  /**
   * Obtiene shipments de todos los tenants con paginación
   */
  async getAllShipments(
    page: number = 1,
    size: number = 10,
  ): Promise<{
    data: Array<any>;
    totalCount: number;
    totalPages: number;
    tenantsProcessed: number;
  }> {
    const tenants = await this.getAllTenants();
    const allShipments: Array<any> = [];
    let tenantsProcessed = 0;

    for (const tenant of tenants) {
      try {
        const ShipmentModel = await this.tenantModelRegistry.getShipmentModel(
          tenant.tenantName,
        );

        const shipments = await ShipmentModel.find({ isDeleted: { $ne: true } })
          .sort({ createdAt: -1 })
          .exec();

        // Agregar información del tenant a cada shipment
        const shipmentsWithTenant = shipments.map((shipment) => ({
          ...shipment.toObject(),
          tenantInfo: {
            tenantName: tenant.tenantName,
            name: tenant.name,
          },
        }));

        allShipments.push(...shipmentsWithTenant);
        tenantsProcessed++;
      } catch (error) {
        this.logger.error(
          `Error obteniendo shipments de ${tenant.tenantName}:`,
          error.message,
        );
        // Continuar con el siguiente tenant en caso de error
      }
    }

    // Ordenar todos los shipments por fecha de creación
    allShipments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Aplicar paginación
    const skip = (page - 1) * size;
    const paginatedData = allShipments.slice(skip, skip + size);

    const result = {
      data: paginatedData,
      totalCount: allShipments.length,
      totalPages: Math.ceil(allShipments.length / size),
      tenantsProcessed,
    };

    return result;
  }

  /**
   * Actualiza un shipment específico de un tenant
   */
  async updateShipment(
    tenantName: string,
    shipmentId: string,
    updateData: any,
  ): Promise<ShipmentDocument> {
    try {
      // Validar parámetros
      if (!tenantName || !shipmentId) {
        throw new Error('TenantName y shipmentId son requeridos');
      }

      if (!Types.ObjectId.isValid(shipmentId)) {
        throw new NotFoundException(`ID de shipment inválido: ${shipmentId}`);
      }

      // Verificar que el tenant existe
      const tenant = await this.tenantModel.findOne({
        tenantName,
        isActive: true,
      });
      if (!tenant) {
        throw new NotFoundException(
          `Tenant ${tenantName} no encontrado o inactivo`,
        );
      }

      // Obtener modelo del shipment
      const ShipmentModel =
        await this.tenantModelRegistry.getShipmentModel(tenantName);

      // Verificar que el shipment existe antes de actualizar
      const existingShipment = await ShipmentModel.findOne({
        _id: shipmentId,
        isDeleted: { $ne: true },
      });

      if (!existingShipment) {
        throw new NotFoundException(
          `Shipment con ID ${shipmentId} no encontrado en tenant ${tenantName}`,
        );
      }

      // Actualizar shipment
      const updatedShipment = await ShipmentModel.findByIdAndUpdate(
        shipmentId,
        { ...updateData, updatedAt: new Date() },
        { new: true },
      );

      if (!updatedShipment) {
        throw new Error('Error actualizando shipment');
      }

      return updatedShipment;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales del sistema
   */
  async getSystemStats(): Promise<{
    totalUsers: number;
    usersWithoutTenant: number;
    totalTenants: number;
    totalShipments: number;
  }> {
    const [totalUsers, usersWithoutTenant, totalTenants] = await Promise.all([
      this.userModel.countDocuments({ isDeleted: { $ne: true } }),
      this.userModel.countDocuments({
        tenantId: { $exists: false },
        tenantName: { $exists: false },
        isDeleted: { $ne: true },
      }),
      this.tenantModel.countDocuments({ isActive: true }),
    ]);

    // Contar shipments de todos los tenants
    const tenants = await this.getAllTenants();
    let totalShipments = 0;

    for (const tenant of tenants) {
      try {
        const ShipmentModel = await this.tenantModelRegistry.getShipmentModel(
          tenant.tenantName,
        );
        const count = await ShipmentModel.countDocuments({
          isDeleted: { $ne: true },
        });
        totalShipments += count;
      } catch (error) {
        this.logger.error(
          `Error contando shipments de ${tenant.tenantName}:`,
          error.message,
        );
      }
    }

    return {
      totalUsers,
      usersWithoutTenant,
      totalTenants,
      totalShipments,
    };
  }
}
