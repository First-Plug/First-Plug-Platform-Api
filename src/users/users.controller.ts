import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  Delete,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByProviderDto } from './dto/create-user-by-provider.dto';
import { UpdateUserConfigDto } from './dto/update-user-config.dto';
import { AssignTenantToUsersDto } from './dto/assign-tenant-to-users.dto';
import { AssignTenantSuperAdminDto } from './dto/assign-tenant-superadmin.dto';
import { UpdateUserSuperAdminDto } from './dto/update-user-superadmin.dto';
import { TenantUserAdapterService } from '../common/services/tenant-user-adapter.service';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantUserAdapter: TenantUserAdapterService,
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('provider')
  async createByProvider(@Body() dto: CreateUserByProviderDto) {
    return this.usersService.createByProvider(dto);
  }

  @UseGuards(JwtGuard)
  @Get('profile')
  async getUserProfile(@Req() request: Request) {
    const user = (request as any).user;

    const profile = await this.usersService.getUserProfile(user._id);
    if (!profile) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return profile;
  }

  @UseGuards(JwtGuard)
  @Patch('profile')
  async updateUserProfile(
    @Req() request: Request,
    @Body() updateData: UpdateUserConfigDto,
  ) {
    const user = (request as any).user;

    const updatedProfile = await this.usersService.updateUserProfile(
      user._id,
      updateData,
    );

    if (!updatedProfile) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return updatedProfile;
  }

  // ==================== SUPERADMIN ENDPOINTS (DEBEN IR ANTES DE :id) ====================

  /**
   * Obtener usuarios sin tenant asignado (SuperAdmin only)
   */
  @Get('unassigned')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async getUnassignedUsers() {
    return await this.usersService.findUnassignedUsers();
  }

  /**
   * Obtener usuarios con tenant asignado o SuperAdmins (SuperAdmin only)
   */
  @Get('assigned')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async getAssignedUsers() {
    return await this.usersService.findAssignedUsers();
  }

  /**
   * Obtener TODOS los usuarios del sistema (SuperAdmin only)
   */
  @Get('all-cross-tenant')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async getAllUsers() {
    return await this.usersService.findAllUsers();
  }

  // ==================== ENDPOINTS GENERICOS (DEBEN IR DESPUES) ====================

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.getById(new Types.ObjectId(id));
  }

  @Get()
  async getByEmail(@Query('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Patch(':id/activate')
  async activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(new Types.ObjectId(id));
  }

  @Patch(':id/config')
  async updateUserConfig(
    @Param('id') id: string,
    @Body() dto: UpdateUserConfigDto,
  ) {
    return this.usersService.updateUserConfig(new Types.ObjectId(id), dto);
  }

  @Patch(':id/assign-tenant/:tenantId')
  async assignTenant(
    @Param('id') id: string,
    @Param('tenantId') tenantId: string,
  ) {
    return this.usersService.assignTenant(
      new Types.ObjectId(id),
      new Types.ObjectId(tenantId),
    );
  }

  @Patch('assign-tenant')
  async assignTenantToUsers(@Body() dto: AssignTenantToUsersDto) {
    const userIds = dto.userIds.map((id) => new Types.ObjectId(id));
    const tenantId = new Types.ObjectId(dto.tenantId);
    return this.usersService.assignTenantToMultipleUsers(userIds, tenantId);
  }

  @UseGuards(JwtGuard)
  @Patch('widgets')
  async updateWidgets(
    @Req() request: Request,
    @Body() dashboardData: { widgets: any[] },
  ) {
    console.log('📱 Actualizando widgets para usuario:', {
      userId: (request as any).user._id,
      widgetsCount: dashboardData.widgets?.length || 0,
    });

    // Usar el adaptador para manejar usuarios viejos y nuevos
    return await this.tenantUserAdapter.updateUserWidgets(
      (request as any).user._id,
      dashboardData.widgets,
    );
  }

  /**
   * Asignar tenant a usuario (SuperAdmin only)
   */
  @Patch(':id/assign-tenant-superadmin')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async assignTenantSuperAdmin(
    @Param('id') userId: string,
    @Body() assignData: AssignTenantSuperAdminDto,
  ) {
    return await this.usersService.assignTenantSuperAdmin(
      userId,
      assignData.tenantId,
      assignData.role || 'user',
    );
  }

  /**
   * Toggle active status (SuperAdmin only)
   */
  @Patch(':id/toggle-active')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async toggleActiveStatus(@Param('id') userId: string) {
    return await this.usersService.toggleActiveStatus(userId);
  }

  /**
   * Actualizar datos básicos de usuario (SuperAdmin only)
   */
  @Patch(':id/update-superadmin')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async updateUserSuperAdmin(
    @Param('id') userId: string,
    @Body() updateData: UpdateUserSuperAdminDto,
  ) {
    return await this.usersService.updateUserSuperAdmin(userId, updateData);
  }

  /**
   * Soft delete user (SuperAdmin only)
   */
  @Delete(':id')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async softDeleteUser(@Param('id') userId: string) {
    return await this.usersService.softDelete(userId);
  }

  // ==================== ENDPOINT TEMPORAL PARA RESETEAR SUPERADMIN ====================

  /**
   * ENDPOINT TEMPORAL: Resetear password de SuperAdmin
   * ELIMINAR DESPUÉS DE USAR
   */
  @Patch('reset-superadmin-password')
  async resetSuperAdminPassword() {
    return await this.usersService.resetSuperAdminPassword();
  }
}
