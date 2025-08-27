import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { GetShipmentsCrossTenantDto } from './dto/get-shipments-cross-tenant.dto';
import { UpdateShipmentCompleteDto } from './dto/update-shipment-complete.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantOfficeDto } from './dto/update-tenant-office.dto';
import { Request } from 'express';

@Controller('superadmin')
@UseGuards(JwtGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ==================== SHIPMENTS ENDPOINTS ====================

  /**
   * Obtener shipments por tenant específico (SuperAdmin only)
   */
  @Get('shipments/by-tenant/:tenantName')
  async getShipmentsByTenant(@Param('tenantName') tenantName: string) {
    return await this.superAdminService.getShipmentsByTenant(tenantName);
  }

  /**
   * Obtener shipments de múltiples tenants (SuperAdmin only)
   */
  @Post('shipments/cross-tenant')
  async getShipmentsCrossTenant(@Body() body: GetShipmentsCrossTenantDto) {
    return await this.superAdminService.getAllShipmentsCrossTenant(
      body.tenantNames,
    );
  }

  /**
   * Obtener TODOS los shipments de TODOS los tenants (SuperAdmin only)
   * Cada shipment incluye el tenantName
   */
  @Get('shipments/all')
  async getAllShipments() {
    return await this.superAdminService.getAllShipmentsAllTenants();
  }

  /**
   * Update completo de shipment - Reemplaza Retool (SuperAdmin only)
   * Actualiza precio, URL, courier, status, etc. y desencadena toda la lógica
   */
  @Patch('shipments/:tenantName/:shipmentId/complete-update')
  async updateShipmentComplete(
    @Param('tenantName') tenantName: string,
    @Param('shipmentId') shipmentId: string,
    @Body() updateData: UpdateShipmentCompleteDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user._id;

    return await this.superAdminService.updateShipmentComplete(
      tenantName,
      shipmentId,
      updateData,
      userId,
    );
  }

  // ==================== TENANTS ENDPOINTS ====================

  /**
   * Obtener todos los tenants - Solo datos básicos para tabla (SuperAdmin only)
   */
  @Get('tenants')
  async getAllTenants() {
    return await this.superAdminService.getAllTenantsSimple();
  }

  /**
   * Obtener todos los tenants con información enriquecida (SuperAdmin only)
   */
  @Get('tenants/detailed')
  async getAllTenantsDetailed() {
    return await this.superAdminService.getAllTenantsWithDetails();
  }

  /**
   * Obtener estadísticas de tenants (SuperAdmin only)
   */
  @Get('tenants/stats')
  async getTenantStats() {
    return await this.superAdminService.getTenantStats();
  }

  /**
   * Obtener tenant por nombre único (SuperAdmin only)
   */
  @Get('tenants/by-name/:tenantName')
  async getTenantByName(@Param('tenantName') tenantName: string) {
    return await this.superAdminService.getTenantByName(tenantName);
  }

  /**
   * Obtener un tenant específico con información completa (SuperAdmin only)
   */
  @Get('tenants/:id')
  async getTenantById(@Param('id') tenantId: string) {
    return await this.superAdminService.getTenantById(tenantId);
  }

  /**
   * Toggle isActive status de un tenant - Pause/Play (SuperAdmin only)
   */
  @Patch('tenants/:tenantId/toggle-active')
  async toggleTenantActive(
    @Param('tenantId') tenantId: string,
    @Req() request: Request,
  ) {
    const userId = (request as any).user._id;
    return await this.superAdminService.toggleTenantActiveStatus(
      tenantId,
      userId,
    );
  }

  /**
   * Obtener usuarios de un tenant específico - Details (SuperAdmin only)
   */
  @Get('tenants/:tenantId/users')
  async getTenantUsers(@Param('tenantId') tenantId: string) {
    return await this.superAdminService.getTenantUsers(tenantId);
  }

  /**
   * Crear nuevo tenant (SuperAdmin only)
   */
  @Post('tenants')
  async createTenant(
    @Body() createData: CreateTenantDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user._id;
    return await this.superAdminService.createTenant(createData, userId);
  }

  /**
   * Actualizar tenant (SuperAdmin only)
   */
  @Patch('tenants/:tenantId')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() updateData: UpdateTenantDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user._id;
    return await this.superAdminService.updateTenant(
      tenantId,
      updateData,
      userId,
    );
  }

  /**
   * Actualizar oficina de un tenant (SuperAdmin only)
   */
  @Patch('tenants/:tenantId/office')
  async updateTenantOffice(
    @Param('tenantId') tenantId: string,
    @Body() officeData: UpdateTenantOfficeDto,
  ) {
    return await this.superAdminService.updateTenantOffice(
      tenantId,
      officeData,
    );
  }

  /**
   * Eliminar tenant (soft delete) (SuperAdmin only)
   */
  @Delete('tenants/:id')
  async deleteTenant(@Param('id') tenantId: string) {
    return await this.superAdminService.deleteTenant(tenantId);
  }

  // ==================== MIGRATION ENDPOINTS ====================

  /**
   * Migrar tenant del modelo viejo al nuevo (SuperAdmin only)
   */
  @Post('migrate-tenant/:tenantName')
  async migrateTenant(@Param('tenantName') tenantName: string) {
    return await this.superAdminService.migrateTenantArchitecture(tenantName);
  }
}
