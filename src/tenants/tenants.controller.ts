import {
  Body,
  Controller,
  Patch,
  Get,
  Post,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { TenantsService } from './tenants.service';

import { Request } from 'express';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantService: TenantsService) {}

  @Get('migrate/:tenantName')
  async migrateRecoverable(@Param('tenantName') tenantName: string) {
    await this.tenantService.migrateRecoverableConfig(tenantName);
    return {
      message: `Migración de isRecoverable completada para tenant: ${tenantName}`,
    };
  }

  @Get('recoverable-config/:tenantName')
  async getRecoverableConfig(@Param('tenantName') tenantName: string) {
    const config = await this.tenantService.getRecoverableConfig(tenantName);
    return config;
  }

  @UseGuards(JwtGuard)
  @Get('config')
  async getTenantConfig(@Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;

    console.log('🏢 Obteniendo configuración de tenant:', { tenantName });

    // Obtener configuración directamente del servicio
    const tenant = await this.tenantService.getByTenantName(tenantName);
    if (!tenant) {
      throw new Error(`Tenant no encontrado: ${tenantName}`);
    }

    return {
      tenantName: tenant.tenantName,
      name: tenant.name,
      isRecoverableConfig: tenant.isRecoverableConfig,
      computerExpiration: tenant.computerExpiration,
    };
  }

  @Post('notify-birthday-gift')
  async notifyBirthdayGiftInterest(
    @Body('email') email: string,
    @Body('tenantName') tenantName: string,
  ) {
    return this.tenantService.notifyBirthdayGiftInterest(email, tenantName);
  }

  @Post('notify-shop')
  async notifyShopInterest(
    @Body('email') email: string,
    @Body('tenantName') tenantName: string,
  ) {
    return this.tenantService.notifyShopInterest(email, tenantName);
  }

  @Post('notify-computer-upgrade')
  async notifyComputerUpgrade(
    @Body('email') email: string,
    @Body('tenantName') tenantName: string,
    @Body('category') category: string,
    @Body('brand') brand: string,
    @Body('model') model: string,
    @Body('serialNumber') serialNumber: string,
    @Body('acquisitionDate') acquisitionDate: string,
    @Body('status') status: string,
    @Body('location') location: string,
  ) {
    return this.tenantService.notifyComputerUpgrade({
      email,
      tenantName,
      category,
      brand,
      model,
      serialNumber,
      acquisitionDate,
      status,
      location,
    });
  }

  @Patch('update-recoverable')
  async updateRecoverableConfig(
    @Body('tenantName') tenantName: string,
    @Body('isRecoverableConfig') isRecoverableConfig: Record<string, boolean>,
  ) {
    await this.tenantService.updateRecoverableConfig(
      tenantName,
      isRecoverableConfig,
    );
    return {
      message: `Configuración de isRecoverable actualizada para tenant: ${tenantName}`,
    };
  }

  @Patch('migrate-expiration/:tenantName')
  async migrateExpiration(@Param('tenantName') tenantName: string) {
    await this.tenantService.migrateComputerExpiration(tenantName);
    return {
      message: `Migración de computerExpiration completada para tenantName: ${tenantName}`,
    };
  }

  @Patch('migrate-expiration')
  async migrateAllExpirations() {
    await this.tenantService.migrateAllComputerExpirations();
    return {
      message: `Migración de computerExpiration completada para todos los tenants.`,
    };
  }

  @Patch('update-computer-expiration/:tenantName')
  async updateComputerExpiration(
    @Param('tenantName') tenantName: string,
    @Body('computerExpiration') computerExpiration: number,
  ) {
    await this.tenantService.updateComputerExpiration(
      tenantName,
      computerExpiration,
    );
    return {
      message: `Configuración de computerExpiration actualizada para tenant: ${tenantName}`,
    };
  }
}
