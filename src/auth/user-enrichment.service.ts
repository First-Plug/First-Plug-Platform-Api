import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class UserEnrichmentService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Detecta si es un usuario del esquema viejo (tiene tenantName pero no tenantId)
   */
  private isOldSchemaUser(user: any): boolean {
    return !user.tenantId && user.tenantName;
  }

  /**
   * Detecta si es un usuario del esquema nuevo (tiene tenantId)
   */
  private isNewSchemaUser(user: any): boolean {
    return !!user.tenantId;
  }

  /**
   * Enriquece un usuario con datos del tenant para mantener compatibilidad
   * con la estructura anterior donde todo estaba acoplado.
   * Soporta tanto usuarios viejos como nuevos.
   */
  async enrichUserWithTenantData(user: User): Promise<any> {
    // CASO 1: Usuario del esquema viejo (tenantName directo, sin tenantId)
    if (this.isOldSchemaUser(user)) {
      return {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        image: user.image || '',

        // Datos personales (ya embebidos en el usuario viejo)
        address: user.address || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        zipCode: user.zipCode || '',
        phone: user.phone || '',

        // Datos de autenticación
        password: user.password,
        salt: user.salt,
        accountProvider: user.accountProvider,
        status: user.status,
        isActive: user.isActive,
        role: user.role || 'user', // Incluir rol

        // Datos del tenant (ya embebidos en el usuario viejo)
        tenantId: null, // Usuarios viejos no tienen tenantId
        tenantName: (user as any).tenantName,
        isRecoverableConfig: (user as any).isRecoverableConfig || new Map(),
        computerExpiration: (user as any).computerExpiration || 3,
        widgets: user.widgets || [],
      };
    }

    // CASO 2: Usuario sin tenant asignado (nuevo schema pero sin tenant)
    if (!user.tenantId) {
      return {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        image: user.image || '',
        address: user.address || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        zipCode: user.zipCode || '',
        phone: user.phone || '',
        accountProvider: user.accountProvider,
        status: user.status,
        isActive: user.isActive,
        role: user.role || 'user', // Incluir rol
        // Valores por defecto para campos del tenant
        tenantId: user.tenantId || null, // ← AGREGAR tenantId
        tenantName: null,
        isRecoverableConfig: new Map(),
        computerExpiration: 3,
        widgets: user.widgets || [],
      };
    }

    // CASO 3: Usuario del esquema nuevo (tiene tenantId)
    if (this.isNewSchemaUser(user)) {
      // Buscar datos del tenant
      console.log('🔍 Buscando tenant para usuario:', {
        email: user.email,
        tenantId: user.tenantId.toString(),
      });

      const tenant = await this.tenantsService.getTenantById(
        user.tenantId.toString(),
      );

      console.log('📋 Tenant encontrado:', {
        tenantId: tenant?._id,
        tenantName: tenant?.tenantName,
        name: tenant?.name,
      });

      // Construir el objeto "enriquecido" con la estructura que espera el sistema
      return {
        // Datos del usuario
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        image: user.image || '',

        // Datos personales del usuario (dirección personal, etc.)
        address: user.address || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        zipCode: user.zipCode || '',
        phone: user.phone || '',

        // Datos de autenticación
        password: user.password,
        salt: user.salt,
        accountProvider: user.accountProvider,
        status: user.status,
        isActive: user.isActive,
        role: user.role || 'user', // Incluir rol

        // Datos del tenant (para mantener compatibilidad)
        tenantId: user.tenantId, // ← AGREGAR tenantId
        tenantName: tenant?.tenantName || null,
        isRecoverableConfig: tenant?.isRecoverableConfig || new Map(),
        computerExpiration: tenant?.computerExpiration || 3,
        widgets: user.widgets || [], // Widgets ahora vienen del usuario
      };
    }

    // Si llegamos aquí, algo salió mal
    throw new Error('Usuario en estado inconsistente');
  }

  /**
   * Busca un usuario por email y lo enriquece con datos del tenant.
   * Busca primero en la colección 'users' (nuevos) y luego en 'tenants' (viejos).
   */
  async findEnrichedUserByEmail(email: string): Promise<any> {
    // PRIMERO: Buscar en colección 'users' (usuarios nuevos)
    const user = await this.usersService.findByEmail(email);

    if (user) {
      console.log('📍 Usuario NUEVO encontrado en colección USERS');
      const enrichedUser = await this.enrichUserWithTenantData(user);
      return enrichedUser;
    }

    // SEGUNDO: Buscar en colección 'tenants' (usuarios viejos)
    const oldUser = await this.tenantsService.findByEmail(email);

    if (!oldUser) {
      return null;
    }

    console.log('📍 Usuario VIEJO encontrado en colección TENANTS');

    // Convertir a objeto plano para acceder a campos dinámicos
    const oldUserData = (
      oldUser.toObject ? oldUser.toObject() : oldUser
    ) as any;

    // Para usuarios viejos, los datos ya están embebidos
    const enrichedOldUser = {
      _id: oldUserData._id,
      email: oldUserData.email,
      firstName: oldUserData.name?.split(' ')[0] || '',
      lastName: oldUserData.name?.split(' ').slice(1).join(' ') || '',
      name: oldUserData.name || '',
      image: oldUserData.image || '',

      // Datos personales (embebidos en el usuario viejo)
      address: oldUserData.address || '',
      apartment: oldUserData.apartment || '',
      city: oldUserData.city || '',
      state: oldUserData.state || '',
      country: oldUserData.country || '',
      zipCode: oldUserData.zipCode || '',
      phone: oldUserData.phone || '',

      // Datos de autenticación
      password: oldUserData.password,
      salt: oldUserData.salt,
      accountProvider: oldUserData.accountProvider,
      status: 'active', // Usuarios viejos están activos
      isActive: true,
      role: oldUserData.role || 'user', // Incluir rol (usuarios viejos son 'user' por defecto)

      // Datos del tenant (embebidos en el usuario viejo)
      tenantId: null, // Usuarios viejos no tienen tenantId
      tenantName: oldUserData.tenantName,
      isRecoverableConfig: oldUserData.isRecoverableConfig || new Map(),
      computerExpiration: oldUserData.computerExpiration || 3,
      widgets: oldUserData.widgets || [],
    };

    return enrichedOldUser;
  }

  /**
   * Actualiza la configuración de un usuario (incluyendo contraseña)
   */
  async updateUserConfig(userId: any, updateData: any): Promise<any> {
    return this.usersService.updateUserConfig(userId, updateData);
  }
}
