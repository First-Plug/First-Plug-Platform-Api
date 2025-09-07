import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtGuard } from '../guard/jwt.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import { SuperAdminAuditInterceptor } from './interceptors/super-admin-audit.interceptor';
import { AssignTenantDto } from './dto/assign-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateOfficeDto } from './dto/update-office.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Controller('super-admin')
@UseGuards(JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminAuditInterceptor)
export class SuperAdminController {
  private readonly logger = new Logger(SuperAdminController.name);

  constructor(private readonly superAdminService: SuperAdminService) {}

  /**
   * Obtiene estadísticas generales del sistema
   */
  @Get('stats')
  async getSystemStats() {
    this.logger.log('👑 SuperAdmin: Solicitando estadísticas del sistema');
    return this.superAdminService.getSystemStats();
  }

  /**
   * Obtiene todos los usuarios del sistema
   */
  @Get('users')
  async getAllUsers() {
    this.logger.log('👑 SuperAdmin: Solicitando todos los usuarios');
    return this.superAdminService.getAllUsers();
  }

  /**
   * Obtiene usuarios sin tenant asignado
   */
  @Get('users/without-tenant')
  async getUsersWithoutTenant() {
    this.logger.log('👑 SuperAdmin: Solicitando usuarios sin tenant');
    return this.superAdminService.getUsersWithoutTenant();
  }

  /**
   * Asigna un tenant a un usuario
   */
  @Post('users/:userId/assign-tenant')
  async assignTenantToUser(
    @Param('userId') userId: string,
    @Body() assignTenantDto: AssignTenantDto,
  ) {
    this.logger.log(`👑 SuperAdmin: Asignando tenant a usuario ${userId}`);
    return this.superAdminService.assignTenantToUser(
      userId,
      assignTenantDto.tenantId,
    );
  }

  /**
   * Obtiene todos los tenants del sistema
   */
  @Get('tenants')
  async getAllTenants() {
    this.logger.log('👑 SuperAdmin: Solicitando todos los tenants');
    return this.superAdminService.getAllTenants();
  }

  /**
   * Actualiza información de un tenant
   */
  @Patch('tenants/:tenantId')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    this.logger.log(`👑 SuperAdmin: Actualizando tenant ${tenantId}`);
    return this.superAdminService.updateTenant(tenantId, updateTenantDto);
  }

  /**
   * Obtiene la oficina por defecto de un tenant
   */
  @Get('tenants/:tenantName/office')
  async getTenantOffice(@Param('tenantName') tenantName: string) {
    this.logger.log(`👑 SuperAdmin: Obteniendo oficina de ${tenantName}`);
    return this.superAdminService.getTenantDefaultOffice(tenantName);
  }

  /**
   * Actualiza la oficina de un tenant
   */
  @Patch('tenants/:tenantName/office/:officeId')
  async updateTenantOffice(
    @Param('tenantName') tenantName: string,
    @Param('officeId') officeId: string,
    @Body() updateOfficeDto: UpdateOfficeDto,
  ) {
    this.logger.log(
      `👑 SuperAdmin: Actualizando oficina ${officeId} de ${tenantName}`,
    );
    return this.superAdminService.updateTenantOffice(
      tenantName,
      officeId,
      updateOfficeDto,
    );
  }

  /**
   * Obtiene todos los shipments del sistema con paginación
   */
  @Get('shipments')
  async getAllShipments(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('size', new ParseIntPipe({ optional: true })) size: number = 10,
  ) {
    this.logger.log(
      `👑 SuperAdmin: Obteniendo shipments (página ${page}, tamaño ${size})`,
    );
    return this.superAdminService.getAllShipments(page, size);
  }

  /**
   * Actualiza un shipment específico
   */
  @Patch('shipments/:tenantName/:shipmentId')
  async updateShipment(
    @Param('tenantName') tenantName: string,
    @Param('shipmentId') shipmentId: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
  ) {
    this.logger.log(
      `👑 SuperAdmin: Actualizando shipment ${shipmentId} en ${tenantName}`,
    );
    return this.superAdminService.updateShipment(
      tenantName,
      shipmentId,
      updateShipmentDto,
    );
  }
}
