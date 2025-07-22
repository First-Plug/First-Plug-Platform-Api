import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { TenantsService } from '../../tenants/tenants.service';
import { OfficesService } from '../../offices/offices.service';
import { TenantUserAdapterService } from './tenant-user-adapter.service';
import { Types } from 'mongoose';

/**
 * Adaptador específico para endpoints del controlador de tenants
 * Redirige internamente a los servicios correctos según el nuevo modelo
 */
@Injectable()
export class TenantEndpointsAdapterService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly officesService: OfficesService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
  ) {}

  /**
   * ADAPTADOR: Actualizar información personal del usuario
   * Frontend llama: PATCH /user/profile
   * Backend redirige a: UsersService.updateProfile()
   */
  async updateUserProfile(userId: string, profileData: any): Promise<any> {
    console.log('🔄 [ADAPTER] Actualizando perfil de usuario:', {
      userId,
      fields: Object.keys(profileData),
    });

    // Separar datos personales (van a users) vs datos de oficina (van a offices)
    const userFields = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone, // Teléfono personal
      address: profileData.address, // Dirección personal
      apartment: profileData.apartment,
      city: profileData.city,
      state: profileData.state,
      country: profileData.country,
      zipCode: profileData.zipCode,
      image: profileData.image,
    };

    // Filtrar campos undefined
    const filteredUserFields = Object.fromEntries(
      Object.entries(userFields).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(filteredUserFields).length > 0) {
      await this.usersService.updateUserConfig(
        new Types.ObjectId(userId),
        filteredUserFields,
      );
      console.log('✅ [ADAPTER] Perfil de usuario actualizado');
    }

    // Retornar usuario actualizado en formato esperado por el frontend
    return this.tenantUserAdapter.findTenantById(userId);
  }

  /**
   * ADAPTADOR: Actualizar información de la oficina
   * Frontend llama: PATCH /user/office-info
   * Backend redirige a: OfficesService.updateOfficeInfo()
   */
  async updateOfficeInfo(userId: string, officeData: any): Promise<any> {
    console.log('🔄 [ADAPTER] Actualizando información de oficina:', {
      userId,
      fields: Object.keys(officeData),
    });

    // Obtener el usuario para encontrar su tenant
    const user = await this.usersService.findById(userId);
    if (!user || !user.tenantId) {
      throw new Error('Usuario no encontrado o sin tenant asociado');
    }

    // Campos que van a la oficina
    const officeFields = {
      name: officeData.officeName || officeData.name,
      email: officeData.officeEmail || officeData.email,
      phone: officeData.officePhone || officeData.phone,
      address: officeData.officeAddress || officeData.address,
      apartment: officeData.officeApartment || officeData.apartment,
      city: officeData.officeCity || officeData.city,
      state: officeData.officeState || officeData.state,
      country: officeData.officeCountry || officeData.country,
      zipCode: officeData.officeZipCode || officeData.zipCode,
    };

    // Filtrar campos undefined
    const filteredOfficeFields = Object.fromEntries(
      Object.entries(officeFields).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(filteredOfficeFields).length > 0) {
      // Necesitamos el tenantName, no el tenantId
      const tenant = await this.tenantsService.getTenantById(
        user.tenantId.toString(),
      );
      if (tenant) {
        await this.officesService.updateDefaultOffice(
          tenant.tenantName,
          filteredOfficeFields as any,
          userId,
        );
        console.log('✅ [ADAPTER] Información de oficina actualizada');
      }
    }

    // Retornar datos actualizados
    return this.tenantUserAdapter.findTenantById(userId);
  }

  /**
   * ADAPTADOR: Obtener perfil completo (usuario + oficina + tenant)
   * Frontend llama: GET /user/profile
   * Backend combina: UsersService + OfficesService + TenantsService
   */
  async getUserProfile(userId: string): Promise<any> {
    console.log('🔄 [ADAPTER] Obteniendo perfil completo:', { userId });

    // Usar el adaptador existente que ya combina todo
    const profile = await this.tenantUserAdapter.findTenantById(userId);

    if (!profile) {
      throw new Error('Perfil de usuario no encontrado');
    }

    console.log('✅ [ADAPTER] Perfil obtenido:', {
      email: profile.email,
      tenantName: profile.tenantName,
      hasOfficeData: !!profile.address,
    });

    return profile;
  }

  /**
   * ADAPTADOR: Actualizar configuración del tenant
   * Frontend llama: PATCH /user/tenant-config
   * Backend redirige a: TenantsService.updateConfig()
   */
  async updateTenantConfig(userId: string, configData: any): Promise<any> {
    console.log('🔄 [ADAPTER] Actualizando configuración de tenant:', {
      userId,
      fields: Object.keys(configData),
    });

    // Obtener el usuario para encontrar su tenant
    const user = await this.usersService.findById(userId);
    if (!user || !user.tenantId) {
      throw new Error('Usuario no encontrado o sin tenant asociado');
    }

    // Campos que van al tenant
    const tenantFields = {
      isRecoverableConfig: configData.isRecoverableConfig,
      computerExpiration: configData.computerExpiration,
    };

    // Filtrar campos undefined
    const filteredTenantFields = Object.fromEntries(
      Object.entries(tenantFields).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(filteredTenantFields).length > 0) {
      await this.tenantsService.update(
        user.tenantId as any,
        filteredTenantFields,
      );
      console.log('✅ [ADAPTER] Configuración de tenant actualizada');
    }

    // Retornar datos actualizados
    return this.tenantUserAdapter.findTenantById(userId);
  }

  /**
   * ADAPTADOR: Obtener configuración de tenant por tenantName
   * Frontend llama: GET /user/tenant-config/:tenantName
   * Backend redirige a: TenantsService.getByTenantName()
   */
  async getTenantConfig(tenantName: string): Promise<any> {
    console.log('🔄 [ADAPTER] Obteniendo configuración de tenant:', {
      tenantName,
    });

    // Usar el adaptador existente que maneja tanto usuarios viejos como nuevos
    const tenantData = await this.tenantUserAdapter.getByTenantName(tenantName);

    if (!tenantData) {
      throw new Error(`Tenant no encontrado: ${tenantName}`);
    }

    console.log('✅ [ADAPTER] Configuración de tenant obtenida:', {
      tenantName: tenantData.tenantName,
      hasRecoverableConfig: !!tenantData.isRecoverableConfig,
      computerExpiration: tenantData.computerExpiration,
    });

    return {
      tenantName: tenantData.tenantName,
      isRecoverableConfig: tenantData.isRecoverableConfig,
      computerExpiration: tenantData.computerExpiration,
    };
  }

  /**
   * ADAPTADOR: Actualizar dashboard (widgets)
   * Frontend llama: PATCH /user/dashboard
   * Backend redirige a: UsersService.updateWidgets()
   */
  async updateDashboard(userId: string, dashboardData: any): Promise<any> {
    console.log('🔄 [ADAPTER] Actualizando dashboard:', {
      userId,
      widgetsCount: dashboardData.widgets?.length || 0,
    });

    // Usar el método existente del adaptador
    const updatedWidgets = await this.tenantUserAdapter.updateDashboard(
      userId,
      dashboardData,
    );

    console.log('✅ [ADAPTER] Dashboard actualizado:', {
      widgetsCount: updatedWidgets.length,
    });

    return updatedWidgets;
  }
}
