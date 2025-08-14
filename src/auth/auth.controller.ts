import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateTenantDto } from '../tenants/dto';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/auth.dto';
import { TenantUserAdapterService } from '../common/services/tenant-user-adapter.service';
import { RefreshJwtGuard } from './guard/refresh.guard';
import { Request } from 'express';
import { JwtGuard } from './guard/jwt.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CreateTenantByProvidersDto } from 'src/tenants/dto/create-tenant-by-providers.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantsService,
    private readonly usersService: UsersService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
  ) {}

  @Post('user')
  async getUserInfo(@Body() { id }: { id: string }) {
    // Usar el adaptador para obtener información completa del usuario
    // independientemente del modelo (viejo o nuevo)
    const userInfo = await this.tenantUserAdapter.findTenantById(id);

    return userInfo;
  }

  @Get('debug/tenants')
  async debugTenants() {
    // Endpoint temporal para debug
    console.log('🔍 Consultando tenants existentes...');
    return {
      message: 'Consulta la consola del servidor para ver los tenants',
      note: 'Usa MongoDB Compass o consulta directamente la colección tenants',
    };
  }
  @Post('register')
  async registerUser(@Body() registerData: any) {
    console.log('👤 Registro de usuario (SIN tenant)');
    console.log('📋 Datos recibidos:', {
      name: registerData.name,
      email: registerData.email,
      hasPassword: !!registerData.password,
    });

    try {
      // Separar nombre en firstName y lastName
      const nameParts = registerData.name.trim().split(' ');
      const firstName = nameParts[0] || registerData.name;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Crear SOLO el usuario (sin tenant)
      const user = await this.usersService.create({
        firstName,
        lastName,
        email: registerData.email,
        password: registerData.password,
        accountProvider: 'credentials',
      });

      console.log('✅ Usuario creado SIN tenant:', {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName || '(sin apellido)',
        tenantId: user.tenantId || 'null (sin asignar)',
      });

      // Retornar en formato compatible con frontend
      return {
        _id: user._id,
        name: registerData.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: null, // Sin tenant asignado
        message:
          'Usuario creado. Debe ser asignado a un tenant para poder hacer login.',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('❌ Error creando usuario:', error);
      throw error;
    }
  }

  @UseGuards(JwtGuard, SuperAdminGuard)
  @Post('create-tenant')
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    console.log('🏢 Creando tenant:', createTenantDto.tenantName);

    try {
      // Crear SOLO el tenant
      const tenant = await this.tenantService.createTenant(
        createTenantDto,
        null as any, // CreatedBy temporal hasta que se implemente FirstPlug UI
      );
      console.log('✅ Tenant creado:', tenant.tenantName);

      return {
        message: 'Tenant creado exitosamente',
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          tenantName: tenant.tenantName,
        },
        note: 'Las oficinas se crearán desde settings cuando el usuario tenga acceso a la aplicación',
      };
    } catch (error) {
      console.error('❌ Error creando tenant:', error);
      throw error;
    }
  }

  @UseGuards(JwtGuard, SuperAdminGuard)
  @Post('assign-tenant-to-user')
  async assignTenantToUser(
    @Body()
    { userEmail, tenantName }: { userEmail: string; tenantName: string },
  ) {
    console.log('🔗 Asignando tenant:', tenantName, 'a usuario:', userEmail);

    try {
      // 1. Buscar usuario por email
      const user = await this.usersService.findByEmail(userEmail);
      if (!user) {
        throw new Error(`Usuario no encontrado: ${userEmail}`);
      }

      // 2. Buscar tenant por nombre
      const tenant = await this.tenantService.getByTenantName(tenantName);
      if (!tenant) {
        throw new Error(`Tenant no encontrado: ${tenantName}`);
      }

      // 3. Asignar tenant al usuario
      await this.usersService.assignTenant(user._id, tenant._id);
      console.log('✅ Usuario asignado al tenant exitosamente');

      return {
        message: 'Usuario asignado al tenant exitosamente',
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          tenantName: tenant.tenantName,
        },
      };
    } catch (error) {
      console.error('❌ Error asignando tenant:', error);
      throw error;
    }
  }

  @Post('register-providers')
  async registerByProviders(
    @Body() createTenantByProvidersDto: CreateTenantByProvidersDto,
  ) {
    return await this.tenantService.createByProviders(
      createTenantByProvidersDto,
    );
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('get-tokens')
  async getTokens(
    @Body() createTenantByProvidersDto: CreateTenantByProvidersDto,
  ) {
    return await this.authService.getTokens(createTenantByProvidersDto);
  }

  @UseGuards(RefreshJwtGuard)
  @Post('refresh')
  async refreshToken(@Req() req) {
    return await this.authService.refreshToken(req.user);
  }

  @UseGuards(JwtGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(req.user, changePasswordDto);
  }
}
