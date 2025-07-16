import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';
import { Types } from 'mongoose';

/**
 * Servicio adaptador para mantener compatibilidad durante la transición
 * de la arquitectura acoplada (tenant-user) a la arquitectura separada
 */
@Injectable()
export class TenantUserAdapterService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly officesService: OfficesService,
  ) {}

  /**
   * Busca un "tenant" por ID pero retorna datos combinados de user + tenant
   * para mantener compatibilidad con código que espera tenant.email
   */
  async findTenantById(id: string | Types.ObjectId): Promise<any> {
    // Primero intentar buscar como usuario (para compatibilidad con código existente)
    const user = await this.usersService.findById(id);

    if (user) {
      // Si encontramos un usuario, enriquecerlo con datos del tenant y oficina
      let tenant: any = null;
      let defaultOffice: any = null;

      if (user.tenantId) {
        tenant = await this.tenantsService.getTenantById(
          user.tenantId.toString(),
        );
        defaultOffice = await this.officesService.findDefaultOffice(
          user.tenantId,
        );
      }

      return {
        // Datos del usuario (lo que antes estaba en tenant)
        _id: user._id,
        email: user.email, // ← Esto es lo que busca el HistoryService
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        image: user.image || '',

        // Datos personales del usuario (dirección personal)
        userAddress: user.address || '',
        userApartment: user.apartment || '',
        userCity: user.city || '',
        userState: user.state || '',
        userCountry: user.country || '',
        userZipCode: user.zipCode || '',
        userPhone: user.phone || '',

        // Para mantener compatibilidad con código que espera estos campos en el tenant
        // (LogisticsService busca tenant.country, tenant.city, etc.)
        // Ahora vienen de la oficina default
        country: (defaultOffice as any)?.country || '',
        city: (defaultOffice as any)?.city || '',
        state: (defaultOffice as any)?.state || '',
        zipCode: (defaultOffice as any)?.zipCode || '',
        address: (defaultOffice as any)?.address || '',
        apartment: (defaultOffice as any)?.apartment || '',
        phone: (defaultOffice as any)?.phone || '',

        accountProvider: user.accountProvider,
        status: user.status,
        isActive: user.isActive,

        // Datos del tenant
        tenantName: tenant?.tenantName || null,
        tenantId: user.tenantId,
        isRecoverableConfig: tenant?.isRecoverableConfig || new Map(),
        computerExpiration: tenant?.computerExpiration || 3,
        widgets: tenant?.widgets || [],
      };
    }

    // Si no es un usuario, intentar buscar como tenant real
    const tenant = await this.tenantsService.getTenantById(id.toString());
    return tenant;
  }

  /**
   * Busca múltiples "tenants" por IDs
   */
  async findTenantsByIds(ids: string[]): Promise<any[]> {
    const results = await Promise.all(ids.map((id) => this.findTenantById(id)));

    return results.filter((result) => result !== null);
  }

  /**
   * Busca un usuario por email y lo retorna con formato de "tenant"
   * para mantener compatibilidad
   */
  async findTenantByEmail(email: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    return this.findTenantById(user._id);
  }

  /**
   * Busca un tenant por tenantName y retorna el primer usuario de ese tenant
   * enriquecido con datos de oficina (para LogisticsService).
   * Soporta tanto usuarios viejos como nuevos.
   */
  async getByTenantName(tenantName: string): Promise<any> {
    // PRIMERO: Buscar usuarios viejos que tengan tenantName directo
    const oldUser = await this.usersService.findByTenantName(tenantName);
    if (oldUser) {
      // Usuario viejo - datos ya embebidos
      return {
        _id: oldUser._id,
        email: oldUser.email,
        tenantName: (oldUser as any).tenantName,

        // Datos de oficina (embebidos en el usuario viejo)
        country: oldUser.country || '',
        city: oldUser.city || '',
        state: oldUser.state || '',
        zipCode: oldUser.zipCode || '',
        address: oldUser.address || '',
        apartment: oldUser.apartment || '',
        phone: oldUser.phone || '',

        // Configuración del tenant (embebida en el usuario viejo)
        isRecoverableConfig: (oldUser as any).isRecoverableConfig || new Map(),
        computerExpiration: (oldUser as any).computerExpiration || 3,
        widgets: oldUser.widgets || [],
      };
    }

    // SEGUNDO: Buscar en nueva arquitectura
    const tenant = await this.tenantsService.getByTenantName(tenantName);

    if (!tenant) {
      return null;
    }

    // Buscar un usuario de ese tenant
    const users = await this.usersService.findUsersWithSameTenant(
      tenant._id,
      new Date(0), // Fecha muy antigua para obtener todos los usuarios
    );

    if (users.length === 0) {
      // Si no hay usuarios, retornar solo datos del tenant con oficina default
      const defaultOffice = await this.officesService.findDefaultOffice(
        tenant._id,
      );

      return {
        _id: tenant._id,
        tenantName: tenant.tenantName,

        // Datos de la oficina para compatibilidad con LogisticsService
        country: (defaultOffice as any)?.country || '',
        city: (defaultOffice as any)?.city || '',
        state: (defaultOffice as any)?.state || '',
        zipCode: (defaultOffice as any)?.zipCode || '',
        address: (defaultOffice as any)?.address || '',
        apartment: (defaultOffice as any)?.apartment || '',
        phone: (defaultOffice as any)?.phone || '',

        // Datos del tenant
        isRecoverableConfig: tenant.isRecoverableConfig || new Map(),
        computerExpiration: tenant.computerExpiration || 3,
        widgets: [], // Sin widgets a nivel tenant
      };
    }

    // Si hay usuarios, retornar el primero enriquecido
    return this.findTenantById(users[0]._id);
  }

  /**
   * Actualiza un "tenant" (que en realidad puede ser usuario o tenant)
   */
  async updateTenant(
    id: string | Types.ObjectId,
    updateData: any,
  ): Promise<any> {
    // Intentar actualizar como usuario primero
    const user = await this.usersService.findById(id);

    if (user) {
      // Separar datos que van al usuario vs datos que van al tenant
      const userFields = {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        email: updateData.email,
        address: updateData.address,
        apartment: updateData.apartment,
        city: updateData.city,
        state: updateData.state,
        country: updateData.country,
        zipCode: updateData.zipCode,
        phone: updateData.phone,
        image: updateData.image,
        password: updateData.password,
        salt: updateData.salt,
      };

      const tenantFields = {
        isRecoverableConfig: updateData.isRecoverableConfig,
        computerExpiration: updateData.computerExpiration,
        widgets: updateData.widgets,
      };

      // Filtrar campos undefined
      const filteredUserFields = Object.fromEntries(
        Object.entries(userFields).filter(([, value]) => value !== undefined),
      );

      const filteredTenantFields = Object.fromEntries(
        Object.entries(tenantFields).filter(([, value]) => value !== undefined),
      );

      // Actualizar usuario si hay campos para él
      if (Object.keys(filteredUserFields).length > 0) {
        await this.usersService.updateUserConfig(user._id, filteredUserFields);
      }

      // Actualizar tenant si hay campos para él y el usuario tiene tenant
      if (Object.keys(filteredTenantFields).length > 0 && user.tenantId) {
        await this.tenantsService.update(
          user.tenantId as any,
          filteredTenantFields,
        );
      }

      // Retornar el usuario actualizado en formato "enriquecido"
      return this.findTenantById(id);
    }

    // Si no es un usuario, actualizar como tenant
    const tenantId = typeof id === 'string' ? id : id.toString();
    return this.tenantsService.update(tenantId as any, updateData);
  }

  /**
   * Actualiza el dashboard (widgets) de un usuario
   * Maneja tanto usuarios viejos como nuevos
   */
  async updateDashboard(userId: any, dashboardData: any): Promise<any[]> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new Error(`Usuario no encontrado: ${userId}`);
    }

    // Si hay widgets en los datos, actualizar widgets del usuario
    if (dashboardData.widgets) {
      await this.usersService.updateUserConfig(user._id, {
        widgets: dashboardData.widgets,
      });
      return dashboardData.widgets;
    }

    // Si no hay widgets, actualizar otros campos del tenant (si aplica)
    if (user.tenantId) {
      await this.tenantsService.update(user.tenantId as any, dashboardData);
    }

    // Retornar widgets actuales del usuario
    const updatedUser = await this.usersService.findById(userId);
    return updatedUser?.widgets || [];
  }
}
