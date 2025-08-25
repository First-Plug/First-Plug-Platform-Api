import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShipmentsService } from '../shipments/shipments.service';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { EventsGateway } from '../infra/event-bus/events.gateway';
import { ShipmentSchema } from '../shipments/schema/shipment.schema';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { OfficesService } from '../offices/offices.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly eventsGateway: EventsGateway,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly officesService: OfficesService,
  ) {}

  // ==================== SHIPMENTS CROSS-TENANT ====================

  /**
   * Obtener shipments por tenant específico (para SuperAdmin)
   */
  async getShipmentsByTenant(tenantName: string) {
    console.log('📦 SuperAdmin: Obteniendo shipments por tenant:', {
      tenantName,
    });

    return await this.shipmentsService.findAll(tenantName);
  }

  /**
   * Obtener todos los shipments de múltiples tenants (para SuperAdmin)
   */
  async getAllShipmentsCrossTenant(tenantNames: string[]) {
    console.log('📦 SuperAdmin: Obteniendo shipments cross-tenant');

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

    console.log('✅ Shipments cross-tenant obtenidos:', {
      tenantsCount: result.length,
      totalShipments: result.reduce((sum, t) => sum + t.shipments.length, 0),
    });

    return result;
  }

  /**
   * Obtener TODOS los shipments de TODOS los tenants (para SuperAdmin)
   * Cada shipment incluye información del tenant
   */
  async getAllShipmentsAllTenants() {
    try {
      // 1. Obtener todos los tenants del sistema
      const tenants = await this.tenantsService.findAllTenants();
      const tenantNames = tenants.map((tenant) => tenant.tenantName);

      // 2. Obtener shipments de todos los tenants
      const result = await this.getAllShipmentsCrossTenant(tenantNames);

      // 3. Convertir a formato plano con tenantName en cada shipment
      const allShipmentsFlat: any[] = [];

      result.forEach((tenantData) => {
        tenantData.shipments.forEach((shipment) => {
          allShipmentsFlat.push({
            ...shipment,
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
    updateData: {
      price?: number;
      trackingUrl?: string;
      courier?: string;
      shipment_status?: string;
      shipment_type?: string;

      [key: string]: any;
    },
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
        amount: updateData.price,
        currencyCode: 'USD',
      });
    }

    // 2. Actualizar tracking URL y tipo si se proporcionan
    if (updateData.trackingUrl || updateData.shipment_type) {
      result = await this.updateShipmentFields(tenantName, shipmentId, {
        shipment_type: updateData.shipment_type,
        trackingURL: updateData.trackingUrl,
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
        console.log(
          `📡 Websocket notification sent for shipment ${shipmentId} - price updated`,
        );
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
      shipment.shipment_status = newStatus;
      await shipment.save();

      console.log(`📊 Status actualizado: ${oldStatus} → ${newStatus}`);

      // Enviar notificación WebSocket
      try {
        this.eventsGateway.notifyTenant(tenantName, 'shipments-update', {
          shipmentId,
          oldStatus,
          newStatus,
          shipment,
        });
        console.log(
          `📡 Websocket notification sent for shipment ${shipmentId} - status updated`,
        );
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
   */
  async getAllTenantsWithDetails() {
    console.log('🏢 SuperAdmin: Obteniendo todos los tenants con detalles');

    try {
      const tenants = await this.tenantsService.findAllTenants();
      const enrichedTenants: any[] = [];

      for (const tenant of tenants) {
        // 1. Contar usuarios activos por tenant
        const activeUsersCount = await this.countActiveUsersByTenant(
          tenant._id.toString(),
        );

        // 2. Obtener usuarios completos del tenant
        const tenantUsers = await this.getTenantUsers(tenant._id.toString());

        // 3. Obtener datos completos de la oficina
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

        // 4. Transformar al formato del frontend
        const transformedTenant = this.transformTenantForFrontend(
          tenant.toObject ? tenant.toObject() : tenant,
          tenantUsers,
          office,
          activeUsersCount,
        );

        enrichedTenants.push(transformedTenant);
      }

      console.log('✅ Tenants con detalles obtenidos:', {
        total: enrichedTenants.length,
        active: enrichedTenants.filter((t) => t.isActive).length,
        inactive: enrichedTenants.filter((t) => !t.isActive).length,
      });

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

      // Debug temporal - remover después
      console.log(
        `🔍 DEBUG - Contando usuarios para tenant ${tenantId} (${tenant.tenantName}):`,
      );
      console.log(`📊 Total usuarios encontrados: ${users.length}`);

      // Buscar usuarios por tenantId (nuevo sistema) O por tenantName (sistema viejo)
      const usersForTenant = users.filter(
        (user) =>
          user.tenantId?.toString() === tenantId ||
          user.tenantName === tenant.tenantName,
      );
      console.log(
        `🏢 Usuarios del tenant ${tenantId}: ${usersForTenant.length}`,
      );

      const activeUsers = usersForTenant.filter(
        (user) => user.isActive && !user.isDeleted,
      );
      console.log(
        `✅ Usuarios activos del tenant ${tenantId}: ${activeUsers.length}`,
      );

      if (usersForTenant.length > 0) {
        console.log(
          '👥 Usuarios del tenant:',
          usersForTenant.map((u) => ({
            id: u._id,
            email: u.email,
            isActive: u.isActive,
            isDeleted: u.isDeleted,
            tenantId: u.tenantId?.toString(),
            tenantName: u.tenantName, // Mostrar también tenantName
          })),
        );
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

      console.log('✅ Tenant status actualizado:', {
        tenantId,
        tenantName: tenant.tenantName,
        oldStatus: tenant.isActive,
        newStatus,
      });

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
    console.log('🏢 SuperAdmin: Obteniendo tenant específico:', { tenantId });

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

      console.log('✅ Tenant específico obtenido:', {
        tenantId,
        tenantName: tenant.tenantName,
        activeUsers: activeUsersCount,
      });

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
    console.log('👥 SuperAdmin: Obteniendo usuarios del tenant:', { tenantId });

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

      console.log('✅ Usuarios del tenant obtenidos:', {
        tenantId,
        tenantName: tenant.tenantName,
        totalUsers: tenantUsers.length,
        activeUsers: tenantUsers.filter((u) => u.isActive).length,
      });

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
    console.log('🏢 SuperAdmin: Creando nuevo tenant:', { createData, userId });

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

      console.log('✅ Tenant creado exitosamente:', {
        tenantId: newTenant._id,
        tenantName: newTenant.tenantName,
      });

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

      console.log('✅ Tenant actualizado exitosamente:', {
        tenantId,
        tenantName: updatedTenant.tenantName,
        updatedFields: Object.keys(updateData),
      });

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
    console.log('📊 SuperAdmin: Obteniendo estadísticas de tenants');

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

      console.log('✅ Estadísticas de tenants obtenidas:', stats);
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
    console.log('🏢 SuperAdmin: Obteniendo tenant por nombre:', { tenantName });

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

      console.log('✅ Tenant por nombre obtenido:', {
        tenantName,
        tenantId: tenant._id,
        activeUsers: activeUsersCount,
      });

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
    console.log('🏢 SuperAdmin: Actualizando oficina del tenant:', {
      tenantId,
      officeData,
    });

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
        // Actualizar oficina existente usando el método correcto
        office = await this.officesService.updateDefaultOffice(
          tenant.tenantName,
          officeData,
          'superadmin', // userId temporal para SuperAdmin
        );
        console.log('✅ Oficina actualizada:', office._id);
      } else {
        // Crear nueva oficina usando el método correcto
        const newOfficeData = {
          ...officeData,
          name: officeData.name || 'Oficina Principal',
          tenantId: tenant._id.toString(),
        };
        office = await this.officesService.create(newOfficeData as any);
        console.log('✅ Nueva oficina creada:', office._id);
      }

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
    console.log('🗑️ SuperAdmin: Eliminando tenant (soft delete):', {
      tenantId,
    });

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

  // ==================== MIGRATION METHODS ====================

  /**
   * Migrar tenant del modelo viejo (acoplado) al nuevo (separado)
   */
  async migrateTenantArchitecture(tenantName: string) {
    console.log(
      `🚀 SuperAdmin: Iniciando migración de arquitectura para tenant: ${tenantName}`,
    );

    try {
      // 1. Buscar el tenant viejo (con datos de usuario mezclados)
      const oldTenant = await this.tenantsService.getByTenantName(tenantName);
      if (!oldTenant) {
        throw new NotFoundException(`Tenant ${tenantName} not found`);
      }

      // Verificar si ya está migrado (si no tiene email, ya está migrado)
      const oldTenantAny = oldTenant as any;
      if (!oldTenantAny.email) {
        return {
          success: false,
          message: `Tenant ${tenantName} ya está migrado (no tiene datos de usuario)`,
          tenantName,
        };
      }

      console.log(`📋 Tenant encontrado: ${oldTenantAny.email}`);

      // 2. Verificar si ya existe un usuario con este email
      const existingUser = await this.usersService.findByEmail(
        oldTenantAny.email,
      );
      if (existingUser) {
        return {
          success: false,
          message: `Usuario ya migrado: ${oldTenantAny.email}`,
          tenantName,
        };
      }

      // 3. Crear usuario en la colección users
      console.log(`👤 Creando usuario: ${oldTenantAny.email}`);
      const newUser = await this.usersService.create({
        firstName: oldTenant.name?.split(' ')[0] || 'Usuario',
        lastName: oldTenant.name?.split(' ').slice(1).join(' ') || '',
        email: oldTenantAny.email,
        accountProvider: oldTenantAny.accountProvider || 'credentials',
        password: oldTenantAny.password || 'temp-password',
        image: oldTenantAny.image || '',
      });

      // Actualizar el usuario con campos adicionales que no están en CreateUserDto
      const updatedUser = await this.usersService.updateUserProfile(
        newUser._id,
        {
          tenantId: oldTenant._id.toString(),
          tenantName: oldTenant.tenantName,
          widgets: oldTenantAny.widgets || [],
          role: 'user',
          isActive: true,
          isDeleted: false,
        } as any,
      );

      console.log(`✅ Usuario creado y actualizado: ${newUser._id}`);

      // 4. Crear oficina si hay datos de oficina
      let createdOffice: any = null;
      const hasOfficeData =
        oldTenantAny.phone ||
        oldTenantAny.country ||
        oldTenantAny.city ||
        oldTenantAny.address;

      if (hasOfficeData) {
        console.log(`🏢 Creando oficina para tenant: ${tenantName}`);
        createdOffice = await this.officesService.create({
          name: 'Oficina Principal',
          email: oldTenantAny.email,
          phone: oldTenantAny.phone || '',
          country: oldTenantAny.country || '',
          city: oldTenantAny.city || '',
          state: oldTenantAny.state || '',
          zipCode: oldTenantAny.zipCode || '',
          address: oldTenantAny.address || '',
          apartment: oldTenantAny.apartment || '',
          tenantId: oldTenant._id.toString(),
        });
        console.log(`✅ Oficina creada: ${createdOffice._id}`);
      }

      // 5. Limpiar el tenant (remover datos de usuario y oficina)
      console.log(`🧹 Limpiando tenant: ${tenantName}`);
      const updatedTenant = await this.tenantsService.update(
        oldTenant._id as any,
        {
          name: `${oldTenant.name} Company`,
          createdBy: updatedUser?._id || newUser._id,
          isActive: true,
          // Remover campos de usuario y oficina se hace con $unset en el servicio
        } as any,
      );

      console.log(`✅ Tenant actualizado: ${updatedTenant?.name}`);

      return {
        success: true,
        message: `Migración completada exitosamente para tenant: ${tenantName}`,
        tenantName,
        migratedUser: {
          id: updatedUser?._id || newUser._id,
          email: updatedUser?.email || newUser.email,
          firstName: updatedUser?.firstName || newUser.firstName,
        },
        createdOffice: createdOffice
          ? {
              id: createdOffice._id,
              name: createdOffice.name,
            }
          : null,
        updatedTenant: {
          id: updatedTenant?._id,
          name: updatedTenant?.name,
        },
      };
    } catch (error) {
      console.error(`❌ Error en migración de ${tenantName}:`, error);
      return {
        success: false,
        message: `Error en migración: ${error.message}`,
        tenantName,
        error: error.message,
      };
    }
  }
}
