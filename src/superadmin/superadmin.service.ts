import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ShipmentsService } from '../shipments/shipments.service';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { EventsGateway } from '../infra/event-bus/events.gateway';
import { ShipmentSchema } from '../shipments/schema/shipment.schema';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { OfficesService } from '../offices/offices.service';
import { LogisticsService } from '../logistics/logistics.sevice';
import { UpdateShipmentCompleteDto } from './dto/update-shipment-complete.dto';
import { CreateProductForTenantDto } from './dto/create-product-for-tenant.dto';
import { BulkCreateProductsForTenantDto } from './dto/bulk-create-products-for-tenant.dto';
import { WarehousesService } from '../warehouses/warehouses.service';
import { GlobalProductSyncService } from '../products/services/global-product-sync.service';
import mongoose from 'mongoose';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly eventsGateway: EventsGateway,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly officesService: OfficesService,
    private readonly logisticsService: LogisticsService,
    private readonly warehousesService: WarehousesService,
    private readonly globalProductSyncService: GlobalProductSyncService,
  ) {}

  // ==================== SHIPMENTS CROSS-TENANT ====================

  /**
   * Obtener shipments por tenant específico (para SuperAdmin)
   */
  async getShipmentsByTenant(tenantName: string) {
    // antes: return await this.shipmentsService.findAll(tenantName);
    return await this.shipmentsService.findAll(tenantName);
  }

  /**
   * Obtener todos los shipments de múltiples tenants (para SuperAdmin)
   */
  async getAllShipmentsCrossTenant(tenantNames: string[]) {
    const result: { tenantName: string; shipments: any[] }[] = [];

    for (const tenantName of tenantNames) {
      try {
        const shipments = await this.getShipmentsByTenant(tenantName);
        result.push({ tenantName, shipments });
      } catch (error) {
        console.warn(
          `⚠️ Error obteniendo shipments de ${tenantName}:`,
          error.message,
        );
      }
    }

    return result;
  }

  /**
   * Obtener TODOS los shipments de TODOS los tenants (para SuperAdmin)
   * Cada shipment incluye información del tenant
   * Filtra por fechas de creación si se proporcionan
   */
  async getAllShipmentsAllTenants(startDate?: Date, endDate?: Date) {
    try {
      // 1. Obtener todos los tenants del sistema
      const tenants = await this.tenantsService.findAllTenants();
      const tenantNames = tenants.map((tenant) => tenant.tenantName);

      // 2. Obtener shipments de todos los tenants
      const result = await this.getAllShipmentsCrossTenant(tenantNames);

      // 3. Convertir a formato plano con tenantName en cada shipment y filtrar por fechas
      const allShipmentsFlat: any[] = [];

      result.forEach((tenantData) => {
        tenantData.shipments.forEach((shipment) => {
          // Convertir documento de Mongoose a objeto plano de JavaScript
          const shipmentPlain = shipment.toObject
            ? shipment.toObject()
            : shipment;

          // Filtrar por fechas si se proporcionan
          if (startDate || endDate) {
            const createdAt = shipmentPlain.createdAt;

            if (startDate && createdAt < startDate) {
              return; // Saltar este shipment si es anterior a startDate
            }

            if (endDate && createdAt > endDate) {
              return; // Saltar este shipment si es posterior a endDate
            }
          }

          allShipmentsFlat.push({
            ...shipmentPlain,
            tenantName: tenantData.tenantName,
          });
        });
      });

      return {
        totalShipments: allShipmentsFlat.length,
        tenantsProcessed: result.length,
        shipments: allShipmentsFlat,
        tenantBreakdown: result.map((t) => ({
          tenantName: t.tenantName,
          shipmentCount: t.shipments.length,
        })),
      };
    } catch (error) {
      console.error('❌ Error obteniendo todos los shipments:', error);
      throw new BadRequestException(
        `Error obteniendo shipments: ${error.message}`,
      );
    }
  }

  /**
   * Update completo de shipment (reemplaza Retool)
   * Actualiza precio, URL, courier, status, etc. y desencadena toda la lógica
   */
  async updateShipmentComplete(
    tenantName: string,
    shipmentId: string,
    updateData: UpdateShipmentCompleteDto,
    userId: string,
  ) {
    console.log('📦 SuperAdmin: Update completo de shipment:', {
      tenantName,
      shipmentId,
      userId,
      updateData,
    });

    let result: any = null;

    // 1. Actualizar precio si se proporciona
    if (updateData.price !== undefined) {
      result = await this.updateShipmentPrice(tenantName, shipmentId, {
        amount: updateData.price.amount,
        currencyCode: updateData.price.currency,
      });
    }

    // 2. Actualizar tracking URL y tipo si se proporcionan
    if (updateData.trackingURL || updateData.shipment_type) {
      result = await this.updateShipmentFields(tenantName, shipmentId, {
        shipment_type: updateData.shipment_type,
        trackingURL: updateData.trackingURL,
      });
    }

    // 3. Actualizar status si se proporciona
    if (updateData.shipment_status) {
      result = await this.updateShipmentStatus(
        tenantName,
        shipmentId,
        updateData.shipment_status,
      );
    }

    if (!result) {
      result = {
        message: 'Shipment update completed',
        shipmentId,
        tenantName,
        fieldsUpdated: Object.keys(updateData),
      };
    }

    return result;
  }

  // ==================== PRIVATE METHODS (Para gestión de shipments) ====================

  /**
   * Actualizar precio de shipment
   */
  private async updateShipmentPrice(
    tenantName: string,
    shipmentId: string,
    price: { amount: number; currencyCode: string },
  ) {
    try {
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);

      if (!connection) {
        throw new BadRequestException(
          `No se encontró conexión para el tenant: ${tenantName}`,
        );
      }

      const ShipmentModel =
        connection.models.Shipment ||
        connection.model('Shipment', ShipmentSchema, 'shipments');

      if (!ShipmentModel) {
        throw new BadRequestException(
          `No se pudo obtener el modelo Shipment para el tenant: ${tenantName}`,
        );
      }

      const shipment = await ShipmentModel.findById(shipmentId);

      if (!shipment) {
        throw new NotFoundException(
          `No se encontró el shipment con ID: ${shipmentId} en el tenant: ${tenantName}`,
        );
      }

      shipment.price = price;
      await shipment.save();

      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipments-update', {
          shipmentId,
          price,
          shipment,
        });
      } catch (error) {
        console.error(
          `❌ Error sending websocket notification for shipment ${shipmentId}:`,
          error,
        );
      }

      return {
        message: `Shipment actualizado correctamente: price`,
        shipment,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualizar campos de shipment (tracking URL, tipo, etc.)
   */
  private async updateShipmentFields(
    tenantName: string,
    shipmentId: string,
    fields: {
      shipment_type?: string;
      trackingURL?: string;
    },
  ) {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);

    const ShipmentModel =
      connection.models.Shipment ||
      connection.model('Shipment', ShipmentSchema, 'shipments');

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment no encontrado');

    const fieldsUpdated: string[] = [];

    if (fields.shipment_type) {
      shipment.shipment_type = fields.shipment_type;
      fieldsUpdated.push('shipment_type');
    }

    if (fields.trackingURL) {
      shipment.trackingURL = fields.trackingURL;
      fieldsUpdated.push('trackingURL');
    }

    if (fieldsUpdated.length > 0) {
      await shipment.save();

      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipments-update', {
          shipmentId,
          fieldsUpdated,
          shipment,
        });
      } catch (error) {
        console.error(
          `❌ Error sending websocket notification for shipment ${shipmentId}:`,
          error,
        );
      }
    }

    return {
      message: `Shipment actualizado correctamente: ${fieldsUpdated.join(', ')}`,
      shipment,
    };
  }

  /**
   * Actualizar status de shipment (SuperAdmin)
   */
  private async updateShipmentStatus(
    tenantName: string,
    shipmentId: string,
    newStatus: string,
  ) {
    try {
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);

      const ShipmentModel =
        connection.models.Shipment ||
        connection.model('Shipment', ShipmentSchema, 'shipments');

      const shipment = await ShipmentModel.findById(shipmentId);
      if (!shipment) throw new NotFoundException('Shipment no encontrado');

      const oldStatus = shipment.shipment_status;

      if (oldStatus !== 'In Preparation' && oldStatus !== 'On The Way') {
        throw new BadRequestException(
          'Cannot update status if not In Preparation or On The Way',
        );
      }

      shipment.shipment_status = newStatus;
      await shipment.save();

      console.log(`📊 Status actualizado: ${oldStatus} → ${newStatus}`);

      // 🏢 UPDATE: Coordinar actualización de flags de oficinas si el estado cambió
      const originOfficeId = shipment.originOfficeId
        ? new mongoose.Types.ObjectId(shipment.originOfficeId.toString())
        : null;
      const destinationOfficeId = shipment.destinationOfficeId
        ? new mongoose.Types.ObjectId(shipment.destinationOfficeId.toString())
        : null;

      if (originOfficeId || destinationOfficeId) {
        try {
          await this.shipmentsService.shipmentOfficeCoordinator.handleShipmentStatusChange(
            originOfficeId,
            destinationOfficeId,
            oldStatus,
            newStatus,
            tenantName,
          );
          console.log(
            `🏢 Office flags updated for status change: ${oldStatus} → ${newStatus}`,
          );
        } catch (error) {
          console.error('❌ Error updating office flags:', error);
        }
      }

      // ✅ Si el status cambió a "Received" o "Cancelled", actualizar productos y members
      if (newStatus === 'Received' || newStatus === 'Cancelled') {
        const actionText = newStatus === 'Received' ? 'recibido' : 'cancelado';
        console.log(
          `🎯 Shipment ${actionText} - actualizando productos y members...`,
        );
        console.log('📋 Shipment data:', {
          origin: shipment.origin,
          destination: shipment.destination,
          originDetails: shipment.originDetails,
          destinationDetails: shipment.destinationDetails,
        });

        // Actualizar cada producto del shipment
        for (const productId of shipment.products) {
          try {
            if (newStatus === 'Received') {
              await this.logisticsService.updateProductOnShipmentReceived(
                productId.toString(),
                tenantName,
                shipment.origin,
              );
            } else if (newStatus === 'Cancelled') {
              // Para cancelación, usar el método de cancelación de productos
              await this.logisticsService.cancelAllProductsInShipment(
                [productId],
                tenantName,
              );
            }
          } catch (error) {
            console.error(
              `❌ Error actualizando producto ${productId}:`,
              error,
            );
          }
        }

        // Actualizar activeShipment flags de members si no tienen otros shipments activos
        const memberEmails = new Set<string>();

        // Helper function para obtener el mejor email (igual que en Slack helper)
        const getBestEmail = (details: any, location: string) => {
          if (location === 'Our office') {
            return details?.email || '';
          }
          return details?.assignedEmail || details?.email || '';
        };

        // Obtener emails de origin y destination si no son "Our office" o "FP warehouse"
        if (!['Our office', 'FP warehouse'].includes(shipment.origin)) {
          const originEmail = getBestEmail(
            shipment.originDetails,
            shipment.origin,
          );
          if (originEmail) {
            memberEmails.add(originEmail);
            console.log(`📧 Origin email encontrado: ${originEmail}`);
          }
        }

        if (!['Our office', 'FP warehouse'].includes(shipment.destination)) {
          const destinationEmail = getBestEmail(
            shipment.destinationDetails,
            shipment.destination,
          );
          if (destinationEmail) {
            memberEmails.add(destinationEmail);
            console.log(`📧 Destination email encontrado: ${destinationEmail}`);
          }
        }

        // Actualizar activeShipment para cada member involucrado

        for (const memberEmail of memberEmails) {
          try {
            console.log(`🔄 Procesando member: ${memberEmail}`);
            await this.logisticsService.clearMemberActiveShipmentFlagIfNoOtherShipments(
              memberEmail,
              tenantName,
            );
            console.log(`✅ Member ${memberEmail} activeShipment actualizado`);
          } catch (error) {
            console.error(
              `❌ Error actualizando member ${memberEmail}:`,
              error,
            );
          }
        }
      }

      // Send WebSocket notification
      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipments-update', {
          shipmentId,
          oldStatus,
          newStatus,
          shipment,
        });
      } catch (error) {
        console.error(
          `❌ Error sending websocket notification for shipment ${shipmentId}:`,
          error,
        );
      }

      return {
        message: `Shipment status actualizado: ${oldStatus} → ${newStatus}`,
        shipment,
        oldStatus,
        newStatus,
      };
    } catch (error) {
      throw error;
    }
  }

  // ==================== TENANTS MANAGEMENT ====================

  /**
   * Convierte un tenant del formato backend al formato esperado por el frontend
   */
  private transformTenantForFrontend(
    tenant: any,
    users: any[] = [],
    office: any = null,
    activeUsersCount: number = 0,
  ): any {
    // Convertir Map a Record para isRecoverableConfig
    let recoverableConfig = {};
    if (tenant.isRecoverableConfig instanceof Map) {
      recoverableConfig = Object.fromEntries(tenant.isRecoverableConfig);
    } else if (
      tenant.isRecoverableConfig &&
      typeof tenant.isRecoverableConfig === 'object'
    ) {
      recoverableConfig = tenant.isRecoverableConfig;
    }

    // Transformar usuarios al formato esperado
    const transformedUsers = users.map((user) => ({
      id: user._id.toString(),
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'User',
      createdAt: user.createdAt || new Date().toISOString(),
      lastLoginAt: user.lastLoginAt || null,
      isActive: user.isActive || false,
    }));

    // Transformar oficina al formato esperado
    let transformedOffice: any = null;
    if (office) {
      transformedOffice = {
        id: office._id.toString(),
        name: office.name || '',
        email: office.email || '',
        phone: office.phone || '',
        address: office.address || '',
        apartment: office.apartment || '',
        city: office.city || '',
        state: office.state || '',
        country: office.country || '',
        zipCode: office.zipCode || '',
        isDefault: office.isDefault || false,
      };
    }

    return {
      id: tenant._id.toString(),
      tenantName: tenant.tenantName,
      name: tenant.name,
      numberOfActiveUsers: activeUsersCount,
      users: transformedUsers,
      computerExpirationYears: tenant.computerExpiration || 3,
      recoverableConfig,
      office: transformedOffice,
      createdAt: tenant.createdAt || new Date().toISOString(),
      updatedAt: tenant.updatedAt || new Date().toISOString(),
      isActive: tenant.isActive || false,
    };
  }

  /**
   * Obtener todos los tenants con información enriquecida (para SuperAdmin)
   * Optimizado para procesamiento paralelo de múltiples tenants
   */
  async getAllTenantsWithDetails() {
    try {
      // Obtener todos los datos necesarios en paralelo
      const [tenants, allUsers] = await Promise.all([
        this.tenantsService.findAllTenants(),
        this.usersService.findAssignedUsers(),
      ]);

      // Crear mapas para acceso rápido a los datos
      const usersByTenantId = new Map<string, any[]>();
      const usersByTenantName = new Map<string, any[]>();

      // Agrupar usuarios por tenantId y tenantName para compatibilidad con ambos sistemas
      allUsers.forEach((user) => {
        if (user.tenantId) {
          const tenantId = user.tenantId.toString();
          if (!usersByTenantId.has(tenantId)) {
            usersByTenantId.set(tenantId, []);
          }
          usersByTenantId.get(tenantId)!.push(user);
        }
        if (user.tenantName) {
          if (!usersByTenantName.has(user.tenantName)) {
            usersByTenantName.set(user.tenantName, []);
          }
          usersByTenantName.get(user.tenantName)!.push(user);
        }
      });

      // Procesar todos los tenants en paralelo usando Promise.all
      const enrichedTenants = await Promise.all(
        tenants.map(async (tenant) => {
          try {
            const tenantUsersById =
              usersByTenantId.get(tenant._id.toString()) || [];
            const tenantUsersByName =
              usersByTenantName.get(tenant.tenantName) || [];

            const allTenantUsers = [...tenantUsersById, ...tenantUsersByName];

            const uniqueUsers = allTenantUsers.filter(
              (user, index, self) =>
                index ===
                self.findIndex((u) => u._id.toString() === user._id.toString()),
            );

            const activeUsersCount = uniqueUsers.filter(
              (user) => user.isActive && !user.isDeleted,
            ).length;

            const transformedUsers = uniqueUsers.map((user) => ({
              _id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
              createdAt: (user as any).createdAt,
            }));

            let office: any = null;
            try {
              const offices = await this.officesService.findOfficesByTenant(
                tenant.tenantName,
              );
              office = offices.find((o) => o.isDefault) || offices[0] || null;
            } catch (error) {
              console.warn(
                `⚠️ No se pudo obtener oficina para ${tenant.tenantName}:`,
                error.message,
              );
            }

            return this.transformTenantForFrontend(
              tenant.toObject ? tenant.toObject() : tenant,
              transformedUsers,
              office,
              activeUsersCount,
            );
          } catch (error) {
            console.error(
              `❌ Error procesando tenant ${tenant.tenantName}:`,
              error,
            );

            return this.transformTenantForFrontend(
              tenant.toObject ? tenant.toObject() : tenant,
              [],
              null,
              0,
            );
          }
        }),
      );

      return enrichedTenants;
    } catch (error) {
      console.error('❌ Error obteniendo tenants:', error);
      throw new BadRequestException(
        `Error obteniendo tenants: ${error.message}`,
      );
    }
  }

  /**
   * Contar usuarios activos por tenant
   */
  private async countActiveUsersByTenant(tenantId: string): Promise<number> {
    try {
      const users = await this.usersService.findAssignedUsers();

      // Obtener el tenant para buscar también por tenantName
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        console.warn(`⚠️ Tenant ${tenantId} no encontrado`);
        return 0;
      }

      // Buscar usuarios por tenantId (nuevo sistema) O por tenantName (sistema viejo)
      const usersForTenant = users.filter(
        (user) =>
          user.tenantId?.toString() === tenantId ||
          user.tenantName === tenant.tenantName,
      );

      const activeUsers = usersForTenant.filter(
        (user) => user.isActive && !user.isDeleted,
      );

      if (usersForTenant.length > 0) {
      }

      return activeUsers.length;
    } catch (error) {
      console.warn(
        `⚠️ Error contando usuarios del tenant ${tenantId}:`,
        error.message,
      );
      return 0;
    }
  }

  /**
   * Verificar si un tenant tiene oficina configurada
   */
  private async checkTenantHasOffice(tenantName: string): Promise<boolean> {
    try {
      const offices = await this.officesService.findOfficesByTenant(tenantName);
      return offices.length > 0;
    } catch (error) {
      console.warn(
        `⚠️ Error verificando oficina del tenant ${tenantName}:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * Toggle isActive status de un tenant (Pause/Play)
   */
  async toggleTenantActiveStatus(tenantId: string, userId: string) {
    console.log('🔄 SuperAdmin: Toggle active status del tenant:', {
      tenantId,
      userId,
    });

    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      const newStatus = !tenant.isActive;

      // Actualizar el tenant
      const updatedTenant = await this.tenantsService.update(
        tenant._id as any,
        {
          isActive: newStatus,
        } as any,
      );

      return {
        message: `Tenant ${newStatus ? 'activado' : 'desactivado'} correctamente`,
        tenant: updatedTenant,
        previousStatus: tenant.isActive,
        newStatus,
      };
    } catch (error) {
      console.error('❌ Error toggle tenant status:', error);
      throw new BadRequestException(
        `Error actualizando tenant: ${error.message}`,
      );
    }
  }

  /**
   * Obtener un tenant específico con información completa (SuperAdmin)
   */
  async getTenantById(tenantId: string) {
    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Obtener datos completos
      const activeUsersCount = await this.countActiveUsersByTenant(tenantId);
      const tenantUsers = await this.getTenantUsers(tenantId);

      let office: any = null;
      try {
        const offices = await this.officesService.findOfficesByTenant(
          tenant.tenantName,
        );
        office = offices.find((o) => o.isDefault) || offices[0] || null;
      } catch (error) {
        console.warn(
          `⚠️ No se pudo obtener oficina para ${tenant.tenantName}:`,
          error.message,
        );
      }

      // Transformar al formato del frontend
      const transformedTenant = this.transformTenantForFrontend(
        tenant.toObject ? tenant.toObject() : tenant,
        tenantUsers,
        office,
        activeUsersCount,
      );

      return transformedTenant;
    } catch (error) {
      console.error('❌ Error obteniendo tenant específico:', error);
      throw new BadRequestException(
        `Error obteniendo tenant: ${error.message}`,
      );
    }
  }

  /**
   * Obtener usuarios asignados a un tenant específico (Details)
   */
  async getTenantUsers(tenantId: string) {
    try {
      const users = await this.usersService.findAssignedUsers();

      // Obtener el tenant para buscar también por tenantName
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        console.warn(`⚠️ Tenant ${tenantId} no encontrado`);
        return [];
      }

      // Buscar usuarios por tenantId (nuevo sistema) O por tenantName (sistema viejo)
      const tenantUsers = users.filter(
        (user) =>
          user.tenantId?.toString() === tenantId ||
          user.tenantName === tenant.tenantName,
      );

      return tenantUsers.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: (user as any).createdAt,
      }));
    } catch (error) {
      console.error('❌ Error obteniendo usuarios del tenant:', error);
      throw new BadRequestException(
        `Error obteniendo usuarios: ${error.message}`,
      );
    }
  }

  /**
   * Crear nuevo tenant (SuperAdmin)
   */
  async createTenant(
    createData: {
      name: string;
      tenantName: string;
      image?: string;
    },
    userId: string,
  ) {
    try {
      // Validar que no existe un tenant con ese nombre
      const existingTenant = await this.tenantsService.getByTenantName(
        createData.tenantName,
      );
      if (existingTenant) {
        throw new BadRequestException(
          `Ya existe un tenant con el nombre: ${createData.tenantName}`,
        );
      }

      // Crear el tenant usando el servicio existente
      const newTenant = await this.tenantsService.createTenant(
        createData,
        userId as any,
      );

      // Transformar al formato del frontend (tenant recién creado no tiene usuarios ni oficina)
      return this.transformTenantForFrontend(
        newTenant.toObject ? newTenant.toObject() : newTenant,
        [], // Sin usuarios inicialmente
        null, // Sin oficina inicialmente
        0, // Sin usuarios activos inicialmente
      );
    } catch (error) {
      console.error('❌ Error creando tenant:', error);
      throw new BadRequestException(`Error creando tenant: ${error.message}`);
    }
  }

  /**
   * Actualizar tenant (SuperAdmin)
   */
  async updateTenant(
    tenantId: string,
    updateData: {
      name?: string;
      tenantName?: string;
      image?: string;
      computerExpiration?: number;
      isRecoverableConfig?: any;
    },
    userId: string,
  ) {
    console.log('🔄 SuperAdmin: Actualizando tenant:', {
      tenantId,
      updateData,
      userId,
    });

    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Si se está cambiando el tenantName, validar que no existe otro con ese nombre
      if (
        updateData.tenantName &&
        updateData.tenantName !== tenant.tenantName
      ) {
        const existingTenant = await this.tenantsService.getByTenantName(
          updateData.tenantName,
        );
        if (existingTenant) {
          throw new BadRequestException(
            `Ya existe un tenant con el nombre: ${updateData.tenantName}`,
          );
        }
      }

      const updatedTenant = await this.tenantsService.update(
        tenant._id as any,
        updateData as any,
      );

      if (!updatedTenant) {
        throw new BadRequestException('Error actualizando tenant');
      }

      // Obtener datos completos para transformar al formato del frontend
      const activeUsersCount = await this.countActiveUsersByTenant(tenantId);
      const tenantUsers = await this.getTenantUsers(tenantId);

      let office: any = null;
      try {
        const offices = await this.officesService.findOfficesByTenant(
          updatedTenant.tenantName,
        );
        office = offices.find((o) => o.isDefault) || offices[0] || null;
      } catch (error) {
        console.warn(
          `⚠️ No se pudo obtener oficina para ${updatedTenant.tenantName}:`,
          error.message,
        );
      }

      this.eventsGateway.notifyTenant(
        updatedTenant.tenantName,
        'company-updated',
        {
          office,
        },
      );

      // Transformar al formato del frontend
      return this.transformTenantForFrontend(
        updatedTenant.toObject ? updatedTenant.toObject() : updatedTenant,
        tenantUsers,
        office,
        activeUsersCount,
      );
    } catch (error) {
      console.error('❌ Error actualizando tenant:', error);
      throw new BadRequestException(
        `Error actualizando tenant: ${error.message}`,
      );
    }
  }

  /**
   * Obtener estadísticas de tenants (SuperAdmin)
   */
  async getTenantStats() {
    try {
      const tenants = await this.tenantsService.findAllTenants();
      const activeTenants = tenants.filter((t) => t.isActive);

      // Obtener todos los usuarios asignados
      const allUsers = await this.usersService.findAssignedUsers();
      const totalUsers = allUsers.length;

      const averageUsersPerTenant =
        activeTenants.length > 0
          ? Math.round((totalUsers / activeTenants.length) * 10) / 10
          : 0;

      const stats = {
        totalTenants: tenants.length,
        activeTenants: activeTenants.length,
        totalUsers,
        averageUsersPerTenant,
      };

      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de tenants:', error);
      throw new BadRequestException(
        `Error obteniendo estadísticas: ${error.message}`,
      );
    }
  }

  /**
   * Obtener tenant por nombre (SuperAdmin)
   */
  async getTenantByName(tenantName: string) {
    try {
      const tenant = await this.tenantsService.getByTenantName(tenantName);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantName} not found`);
      }

      // Obtener datos completos
      const activeUsersCount = await this.countActiveUsersByTenant(
        tenant._id.toString(),
      );
      const tenantUsers = await this.getTenantUsers(tenant._id.toString());

      let office: any = null;
      try {
        const offices = await this.officesService.findOfficesByTenant(
          tenant.tenantName,
        );
        office = offices.find((o) => o.isDefault) || offices[0] || null;
      } catch (error) {
        console.warn(
          `⚠️ No se pudo obtener oficina para ${tenant.tenantName}:`,
          error.message,
        );
      }

      // Transformar al formato del frontend
      const transformedTenant = this.transformTenantForFrontend(
        tenant.toObject ? tenant.toObject() : tenant,
        tenantUsers,
        office,
        activeUsersCount,
      );

      return transformedTenant;
    } catch (error) {
      console.error('❌ Error obteniendo tenant por nombre:', error);
      throw new BadRequestException(
        `Error obteniendo tenant: ${error.message}`,
      );
    }
  }

  /**
   * Actualizar oficina de un tenant (SuperAdmin)
   */
  async updateTenantOffice(
    tenantId: string,
    officeData: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      apartment?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    },
  ) {
    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Buscar oficina existente o crear una nueva
      let office: any = null;
      try {
        const offices = await this.officesService.findOfficesByTenant(
          tenant.tenantName,
        );
        office = offices.find((o) => o.isDefault) || offices[0] || null;
      } catch (error) {
        console.warn(`⚠️ No se encontró oficina para ${tenant.tenantName}`);
      }

      if (office) {
        // 🔧 Procesar campos a borrar
        const updateData = { ...officeData };
        const officeDataAny = officeData as any;
        if (
          officeDataAny.fieldsToEmpty &&
          officeDataAny.fieldsToEmpty.length > 0
        ) {
          officeDataAny.fieldsToEmpty.forEach((field: string) => {
            (updateData as any)[field] = '';
          });
          delete (updateData as any).fieldsToEmpty; // Remover el campo auxiliar
        }

        // Actualizar oficina existente usando el método correcto
        office = await this.officesService.updateDefaultOffice(
          tenant.tenantName,
          updateData,
          'superadmin', // userId temporal para SuperAdmin
          tenant._id.toString(), // tenantId
        );
      } else {
        // 🔧 CREAR nueva oficina EN LA BASE DE DATOS DEL TENANT
        console.log(
          `🏗️ Creando oficina default para tenant ${tenant.tenantName}`,
        );
        const newOfficeData = {
          ...officeData,
          name: officeData.name || 'Oficina Principal',
        };
        office = await this.officesService.setupDefaultOffice(
          tenant.tenantName,
          tenant._id,
          newOfficeData,
          'superadmin',
        );
      }

      this.eventsGateway.notifyTenant(tenant.tenantName, 'office-updated', {
        office,
      });

      // Devolver el tenant completo actualizado
      return await this.getTenantById(tenantId);
    } catch (error) {
      console.error('❌ Error actualizando oficina del tenant:', error);
      throw new BadRequestException(
        `Error actualizando oficina: ${error.message}`,
      );
    }
  }

  /**
   * Soft delete de un tenant (SuperAdmin)
   */
  async deleteTenant(tenantId: string) {
    try {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Soft delete: marcar como inactivo en lugar de eliminar
      const updatedTenant = await this.tenantsService.update(
        tenant._id as any,
        { isActive: false } as any,
      );

      console.log('✅ Tenant eliminado (soft delete):', {
        tenantId,
        tenantName: updatedTenant?.tenantName,
      });

      return { message: 'Tenant eliminado exitosamente' };
    } catch (error) {
      console.error('❌ Error eliminando tenant:', error);
      throw new BadRequestException(
        `Error eliminando tenant: ${error.message}`,
      );
    }
  }

  // ==================== PRODUCT CREATION FOR TENANTS ====================

  /**
   * Validar que el serial number sea único en el tenant
   */
  private async validateSerialNumberUnique(
    serialNumber: string,
    tenantName: string,
    tenantConnection: any,
  ) {
    if (!serialNumber || serialNumber.trim() === '') {
      return;
    }

    // Importar el schema correctamente
    const { ProductSchema } = await import(
      '../products/schemas/product.schema'
    );
    const ProductModel = tenantConnection.model('Product', ProductSchema);

    // Buscar en la colección de productos
    const productWithSameSerialNumber = await ProductModel.findOne({
      serialNumber: serialNumber.toLowerCase(),
    });

    // Buscar en la colección de miembros (productos asignados)
    const { MemberSchema } = await import('../members/schemas/member.schema');
    const MemberModel = tenantConnection.model('Member', MemberSchema);
    const memberWithProduct = await MemberModel.findOne({
      'products.serialNumber': serialNumber.toLowerCase(),
    });

    if (productWithSameSerialNumber || memberWithProduct) {
      throw new BadRequestException(
        `Serial Number '${serialNumber}' already exists in tenant ${tenantName}`,
      );
    }
  }

  /**
   * Crear producto para un tenant específico desde SuperAdmin
   * El producto se asigna automáticamente a FP warehouse del país seleccionado
   */
  async createProductForTenant(createProductDto: CreateProductForTenantDto) {
    const { tenantName, warehouseCountryCode, ...productData } =
      createProductDto;

    try {
      // 1. Validar que el tenant existe
      const tenant = await this.tenantsService.getByTenantName(tenantName);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantName} not found`);
      }

      // 2. Buscar warehouse para asignación (activo o default) en el país especificado
      const warehouseInfo =
        await this.warehousesService.findWarehouseForProductAssignment(
          warehouseCountryCode,
        );

      if (!warehouseInfo) {
        throw new BadRequestException(
          `No warehouse found in country ${warehouseCountryCode}. Please initialize the country first.`,
        );
      }

      // 2.1. Verificar si es un warehouse real o default (para logging/alertas futuras)
      const isRealPartner = warehouseInfo.partnerType !== 'default';
      if (!isRealPartner) {
        console.warn(
          `⚠️ Using default warehouse for ${warehouseCountryCode}. Consider finding a real logistics partner.`,
        );
      }

      // 3. Conectar a la base de datos del tenant
      const tenantConnection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      // Importar el schema correctamente
      const { ProductSchema } = await import(
        '../products/schemas/product.schema'
      );
      const ProductModel = tenantConnection.model('Product', ProductSchema);

      // 4. Validar serial number único (si se proporciona)
      if (productData.serialNumber) {
        await this.validateSerialNumberUnique(
          productData.serialNumber,
          tenantName,
          tenantConnection,
        );
      }

      // 5. Crear el producto en la colección del tenant
      const newProduct = new ProductModel({
        name: productData.name,
        category: productData.category,
        attributes: productData.attributes,
        serialNumber: productData.serialNumber?.trim() || undefined,
        productCondition: productData.productCondition,
        recoverable: productData.recoverable ?? true,

        // Asignación automática a FP warehouse
        location: 'FP warehouse',
        status: 'Available',
        fp_shipment: false,
        activeShipment: false,

        // Información del warehouse
        fpWarehouse: {
          warehouseId: warehouseInfo._id,
          warehouseCountryCode: warehouseCountryCode.toUpperCase(),
          warehouseName:
            warehouseInfo.name ||
            `Default Warehouse ${warehouseCountryCode.toUpperCase()}`,
          assignedAt: new Date(),
          status: 'STORED',
        },

        createdBy: 'SuperAdmin',
      });

      const savedProduct = await newProduct.save();

      // 5. Sincronizar automáticamente a la colección global
      await this.globalProductSyncService.syncProduct({
        tenantId: tenantName,
        tenantName: tenantName,
        originalProductId: savedProduct._id as any,
        sourceCollection: 'products',

        name: savedProduct.name || '',
        category: savedProduct.category,
        status: savedProduct.status,
        location: savedProduct.location || 'FP warehouse',

        attributes:
          savedProduct.attributes?.map((attr) => ({
            key: attr.key,
            value: String(attr.value),
          })) || [],
        serialNumber: savedProduct.serialNumber || undefined,
        productCondition: savedProduct.productCondition,
        recoverable: savedProduct.recoverable,
        fp_shipment: savedProduct.fp_shipment,
        activeShipment: savedProduct.activeShipment,

        // Validar que fpWarehouse tenga los campos requeridos
        fpWarehouse:
          savedProduct.fpWarehouse &&
          savedProduct.fpWarehouse.warehouseId &&
          savedProduct.fpWarehouse.warehouseCountryCode &&
          savedProduct.fpWarehouse.warehouseName
            ? {
                warehouseId: savedProduct.fpWarehouse.warehouseId as any,
                warehouseCountryCode:
                  savedProduct.fpWarehouse.warehouseCountryCode,
                warehouseName: savedProduct.fpWarehouse.warehouseName,
                assignedAt: savedProduct.fpWarehouse.assignedAt,
                // Mapear 'IN_TRANSIT' a 'IN_TRANSIT_IN' para compatibilidad
                status:
                  savedProduct.fpWarehouse.status === 'IN_TRANSIT'
                    ? 'IN_TRANSIT_IN'
                    : (savedProduct.fpWarehouse.status as
                        | 'STORED'
                        | 'IN_TRANSIT_IN'
                        | 'IN_TRANSIT_OUT'
                        | undefined),
              }
            : undefined,

        // Información adicional
        createdBy: 'SuperAdmin',
      });

      return {
        success: true,
        message: `Product created successfully for tenant ${tenantName}`,
        data: {
          productId: savedProduct._id,
          tenantName,
          warehouseInfo: {
            country: warehouseCountryCode,
            warehouseName:
              warehouseInfo.name ||
              `Default Warehouse ${warehouseCountryCode.toUpperCase()}`,
            warehouseId: warehouseInfo._id,
            isRealPartner,
          },
          product: {
            name: savedProduct.name,
            category: savedProduct.category,
            serialNumber: savedProduct.serialNumber,
            location: savedProduct.location,
            status: savedProduct.status,
          },
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Error creating product for tenant ${tenantName}: ${error.message}`,
      );
    }
  }

  /**
   * Obtener productos de la colección global
   */
  async getGlobalProducts(
    limit: number = 100,
    skip: number = 0,
  ): Promise<{
    products: any[];
    total: number;
    limit: number;
    skip: number;
  }> {
    try {
      const [products, total] = await Promise.all([
        this.globalProductSyncService.getGlobalProducts(limit, skip),
        this.globalProductSyncService.getTotalGlobalProducts(),
      ]);

      return {
        products,
        total,
        limit,
        skip,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting global products:`, error);
      throw error;
    }
  }

  /**
   * Crear múltiples productos del mismo tipo para un tenant específico desde SuperAdmin
   * Cada producto puede asignarse a diferentes warehouses
   */
  async bulkCreateProductsForTenant(
    bulkCreateDto: BulkCreateProductsForTenantDto,
  ) {
    const { tenantName, products, quantity, ...commonProductData } =
      bulkCreateDto;

    try {
      // 1. Validar que quantity coincida con products.length
      if (products.length !== quantity) {
        throw new BadRequestException(
          `Quantity (${quantity}) must match the number of products provided (${products.length})`,
        );
      }

      // 2. Validar que el tenant existe
      const tenant = await this.tenantsService.getByTenantName(tenantName);
      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantName} not found`);
      }

      // 3. Validar serial numbers únicos dentro del request (solo los que no son null/undefined)
      const serialNumbers = products
        .map((p) => p.serialNumber)
        .filter((serial) => serial != null && serial !== '');
      const uniqueSerials = new Set(serialNumbers);
      if (
        serialNumbers.length > 0 &&
        uniqueSerials.size !== serialNumbers.length
      ) {
        throw new BadRequestException(
          'Duplicate serial numbers found in the request',
        );
      }

      // 4. Conectar a la base de datos del tenant
      const tenantConnection =
        await this.tenantConnectionService.getTenantConnection(tenantName);

      // 5. Validar que cada serial number sea único en el tenant
      for (const product of products) {
        if (product.serialNumber) {
          await this.validateSerialNumberUnique(
            product.serialNumber,
            tenantName,
            tenantConnection,
          );
        }
      }
      const { ProductSchema } = await import(
        '../products/schemas/product.schema'
      );
      const ProductModel = tenantConnection.model('Product', ProductSchema);

      // 5. Iniciar transacción
      const session = await tenantConnection.startSession();
      session.startTransaction();

      try {
        const createdProducts: any[] = [];
        const warehouseCache = new Map(); // Cache para warehouses

        // 6. Procesar cada producto
        for (const productInstance of products) {
          const { serialNumber, warehouseCountryCode, additionalInfo } =
            productInstance;

          // 6.1. Buscar warehouse (con cache)
          let warehouseInfo = warehouseCache.get(warehouseCountryCode);
          if (!warehouseInfo) {
            warehouseInfo =
              await this.warehousesService.findWarehouseForProductAssignment(
                warehouseCountryCode,
              );

            if (!warehouseInfo) {
              throw new BadRequestException(
                `No warehouse found in country ${warehouseCountryCode}. Please initialize the country first.`,
              );
            }
            warehouseCache.set(warehouseCountryCode, warehouseInfo);
          }

          // 6.2. Crear el producto
          const newProduct = new ProductModel({
            name: commonProductData.name,
            category: commonProductData.category,
            attributes: commonProductData.attributes,
            serialNumber: serialNumber?.trim() || undefined,
            productCondition: commonProductData.productCondition,
            recoverable: commonProductData.recoverable ?? true,
            acquisitionDate: commonProductData.acquisitionDate,
            price: commonProductData.price,
            additionalInfo: additionalInfo,

            // Asignación automática a FP warehouse
            location: 'FP warehouse',
            status: 'Available',
            fp_shipment: false,
            activeShipment: false,

            // Información del warehouse
            fpWarehouse: {
              warehouseId: warehouseInfo._id,
              warehouseCountryCode: warehouseCountryCode.toUpperCase(),
              warehouseName:
                warehouseInfo.name ||
                `Default Warehouse ${warehouseCountryCode.toUpperCase()}`,
              assignedAt: new Date(),
              status: 'STORED',
            },

            createdBy: 'SuperAdmin',
          });

          const savedProduct = await newProduct.save({ session });
          createdProducts.push(savedProduct);
        }

        // 7. Commit transacción
        await session.commitTransaction();

        // 8. Sincronizar todos los productos a la colección global (en paralelo)
        const syncPromises = createdProducts.map(async (savedProduct: any) => {
          try {
            await this.globalProductSyncService.syncProduct({
              tenantId: tenantName,
              tenantName: tenantName,
              originalProductId: savedProduct._id as any,
              sourceCollection: 'products',

              name: savedProduct.name || '',
              category: savedProduct.category,
              status: savedProduct.status,
              location: savedProduct.location || 'FP warehouse',

              attributes:
                savedProduct.attributes?.map((attr: any) => ({
                  key: attr.key,
                  value: String(attr.value),
                })) || [],
              serialNumber: savedProduct.serialNumber || undefined,
              productCondition: savedProduct.productCondition,
              recoverable: savedProduct.recoverable,
              fp_shipment: savedProduct.fp_shipment,
              activeShipment: savedProduct.activeShipment,
              acquisitionDate: savedProduct.acquisitionDate,
              price: savedProduct.price,
              additionalInfo: savedProduct.additionalInfo,

              fpWarehouse:
                savedProduct.fpWarehouse &&
                savedProduct.fpWarehouse.warehouseId &&
                savedProduct.fpWarehouse.warehouseCountryCode &&
                savedProduct.fpWarehouse.warehouseName
                  ? {
                      warehouseId: savedProduct.fpWarehouse.warehouseId as any,
                      warehouseCountryCode:
                        savedProduct.fpWarehouse.warehouseCountryCode,
                      warehouseName: savedProduct.fpWarehouse.warehouseName,
                      assignedAt: savedProduct.fpWarehouse.assignedAt,
                      status:
                        savedProduct.fpWarehouse.status === 'IN_TRANSIT'
                          ? 'IN_TRANSIT_IN'
                          : (savedProduct.fpWarehouse.status as
                              | 'STORED'
                              | 'IN_TRANSIT_IN'
                              | 'IN_TRANSIT_OUT'
                              | undefined),
                    }
                  : undefined,

              isDeleted: false,
            });
          } catch (syncError) {
            console.error(
              `Error syncing product ${savedProduct._id} to global collection:`,
              syncError,
            );
            // No fallar el bulk create si falla la sincronización
          }
        });

        await Promise.all(syncPromises);

        return {
          success: true,
          message: `Successfully created ${createdProducts.length} products for tenant ${tenantName}`,
          data: {
            tenantName,
            productsCreated: createdProducts.length,
            products: createdProducts.map((product: any) => ({
              _id: product._id,
              name: product.name,
              serialNumber: product.serialNumber,
              warehouseCountryCode: product.fpWarehouse?.warehouseCountryCode,
              warehouseName: product.fpWarehouse?.warehouseName,
            })),
          },
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      console.error('Error in bulkCreateProductsForTenant:', error);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Error creating products for tenant ${tenantName}: ${error.message}`,
      );
    }
  }
}
