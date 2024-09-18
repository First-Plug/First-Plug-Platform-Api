import {
  Body,
  Controller,
  Patch,
  Get,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { UpdateTenantInformationSchemaDto } from './dto/update-information.dto';
import { TenantsService } from './tenants.service';
import { Request } from 'express';

@UseGuards(JwtGuard)
@Controller('user')
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

  @Patch()
  async update(
    @Req() request: Request,
    @Body() updateTenantInformationSchemaDto: UpdateTenantInformationSchemaDto,
  ) {
    return await this.tenantService.updateInformation(
      request.user,
      updateTenantInformationSchemaDto,
    );
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
}
