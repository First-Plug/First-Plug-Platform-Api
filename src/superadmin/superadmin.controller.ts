import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateProductForTenantDto } from './dto/create-product-for-tenant.dto';
import { Request } from 'express';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from '../warehouses/dto';
import { InitializeWarehousesScript } from '../warehouses/scripts/initialize-warehouses.script';
import { GlobalWarehouseMetricsService } from './services/global-warehouse-metrics.service';

@Controller('superadmin')
@UseGuards(JwtGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly warehousesService: WarehousesService,
    private readonly initializeWarehousesScript: InitializeWarehousesScript,
    private readonly globalWarehouseMetricsService: GlobalWarehouseMetricsService,
  ) {}

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
  async getAllShipments(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.superAdminService.getAllShipmentsAllTenants(start, end);
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
   * Obtener todos los tenants con información enriquecida (SuperAdmin only)
   */
  @Get('tenants')
  async getAllTenants() {
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

  // ==================== WAREHOUSES ENDPOINTS ====================

  /**
   * Obtener todos los países con sus warehouses (SuperAdmin only)
   */
  @Get('warehouses')
  async getAllWarehouses() {
    return await this.warehousesService.findAll();
  }

  /**
   * Obtener warehouses de un país específico (SuperAdmin only)
   */
  @Get('warehouses/:country')
  async getWarehousesByCountry(@Param('country') country: string) {
    return await this.warehousesService.findByCountry(country);
  }

  /**
   * Crear un nuevo warehouse en un país (SuperAdmin only)
   */
  @Post('warehouses/:country')
  async createWarehouse(
    @Param('country') country: string,
    @Body() createWarehouseDto: CreateWarehouseDto,
  ) {
    return await this.warehousesService.createWarehouse(
      country,
      createWarehouseDto,
    );
  }

  /**
   * Actualizar un warehouse específico (SuperAdmin only)
   */
  @Patch('warehouses/:country/:warehouseId')
  async updateWarehouse(
    @Param('country') country: string,
    @Param('warehouseId') warehouseId: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    return await this.warehousesService.updateWarehouse(
      country,
      warehouseId,
      updateWarehouseDto,
    );
  }

  /**
   * Activar un warehouse específico (SuperAdmin only)
   */
  @Post('warehouses/:country/:warehouseId/activate')
  async activateWarehouse(
    @Param('country') country: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    return await this.warehousesService.activateWarehouse(country, warehouseId);
  }

  /**
   * Eliminar un warehouse (soft delete) (SuperAdmin only)
   */
  @Delete('warehouses/:country/:warehouseId')
  async deleteWarehouse(
    @Param('country') country: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    await this.warehousesService.deleteWarehouse(country, warehouseId);
    return { message: 'Warehouse deleted successfully' };
  }

  // ==================== WAREHOUSES INITIALIZATION ENDPOINTS ====================

  /**
   * Inicializar todos los países con warehouses vacíos (SuperAdmin only)
   */
  @Post('warehouses/initialize-all')
  async initializeAllWarehouses() {
    await this.initializeWarehousesScript.initializeAllCountries();
    return { message: 'Warehouses initialization completed successfully' };
  }

  /**
   * Inicializar un país específico (SuperAdmin only)
   */
  @Post('warehouses/initialize/:country')
  async initializeCountryWarehouse(@Param('country') country: string) {
    await this.initializeWarehousesScript.initializeCountry(country);
    return { message: `Country ${country} initialized successfully` };
  }

  /**
   * Verificar estado de inicialización de warehouses (SuperAdmin only)
   */
  @Get('warehouses/initialization-status')
  async getWarehousesInitializationStatus() {
    return await this.initializeWarehousesScript.checkInitializationStatus();
  }

  // ==================== GLOBAL METRICS ENDPOINTS ====================

  /**
   * Obtener resumen general del sistema (SuperAdmin only)
   */
  @Get('metrics/overview')
  async getGlobalOverview() {
    const overview =
      await this.globalWarehouseMetricsService.getGlobalOverview();
    return {
      success: true,
      data: overview,
    };
  }

  /**
   * Obtener métricas de todos los warehouses activos (SuperAdmin only)
   */
  @Get('metrics/warehouses')
  async getAllWarehouseMetrics() {
    const metrics =
      await this.globalWarehouseMetricsService.getAllWarehouseMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Obtener métricas de todos los warehouses CON detalle de tenants (SuperAdmin only)
   * Incluye tabla principal + tabla desplegable de tenants
   * Ordenados: primero los que tienen productos
   */
  @Get('metrics/warehouses-with-tenants')
  async getAllWarehousesWithTenants() {
    const warehouses =
      await this.globalWarehouseMetricsService.getAllWarehousesWithTenants();
    return {
      success: true,
      data: warehouses,
    };
  }

  /**
   * Obtener métricas de un warehouse específico (SuperAdmin only)
   */
  @Get('metrics/warehouses/:countryCode/:warehouseId')
  async getWarehouseMetrics(
    @Param('countryCode') countryCode: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    const metrics =
      await this.globalWarehouseMetricsService.getWarehouseMetrics(
        countryCode,
        warehouseId,
      );

    if (!metrics) {
      return {
        success: false,
        message: `Warehouse ${warehouseId} not found in ${countryCode}`,
      };
    }

    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Obtener detalle de tenants para un warehouse específico (SuperAdmin only)
   */
  @Get('metrics/warehouses/:countryCode/:warehouseId/tenants')
  async getWarehouseTenantDetails(@Param('warehouseId') warehouseId: string) {
    const tenants =
      await this.globalWarehouseMetricsService.getWarehouseTenantDetails(
        warehouseId,
      );

    return {
      success: true,
      data: tenants,
    };
  }

  /**
   * Obtener métricas de un país específico (SuperAdmin only)
   */
  @Get('metrics/countries/:countryCode')
  async getCountryMetrics(@Param('countryCode') countryCode: string) {
    const metrics =
      await this.globalWarehouseMetricsService.getCountryMetrics(countryCode);

    if (!metrics) {
      return {
        success: false,
        message: `Country ${countryCode} not found`,
      };
    }

    return {
      success: true,
      data: metrics,
    };
  }

  /**
   * Obtener métricas por categoría de producto (SuperAdmin only)
   */
  @Get('metrics/categories')
  async getProductCategoryMetrics() {
    const metrics =
      await this.globalWarehouseMetricsService.getProductCategoryMetrics();
    return {
      success: true,
      data: metrics,
    };
  }

  // ==================== PRODUCT CREATION ENDPOINTS ====================

  /**
   * Crear producto para un tenant específico (SuperAdmin only)
   * El producto se asigna automáticamente a FP warehouse del país seleccionado
   */
  @Post('products/create-for-tenant')
  async createProductForTenant(
    @Body() createProductDto: CreateProductForTenantDto,
  ) {
    return await this.superAdminService.createProductForTenant(
      createProductDto,
    );
  }

  /**
   * Obtener productos de la colección global
   */
  @Get('global-products')
  async getGlobalProducts() {
    return await this.superAdminService.getGlobalProducts();
  }
}
