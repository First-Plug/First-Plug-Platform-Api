import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { OfficesService } from './offices.service';
import { CreateOfficeDto, UpdateOfficeDto } from './dto';
import { GetOfficesByTenantsDto } from './dto/get-offices-by-tenants.dto';
import { NotFoundException } from '@nestjs/common';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { Request } from 'express';

@Controller('offices')
export class OfficesController {
  constructor(private readonly officesService: OfficesService) {}

  /**
   * Configura la oficina default por primera vez
   * Se llama cuando el usuario completa los datos de oficina por primera vez
   */
  @UseGuards(JwtGuard)
  @Post('setup')
  async setupDefaultOffice(
    @Req() request: Request,
    @Body() setupData: Omit<CreateOfficeDto, 'tenantId' | 'isDefault'>,
  ) {
    const user = (request as any).user;
    const tenantName = user.tenantName;
    const tenantId = new Types.ObjectId(user.tenantId);

    return this.officesService.setupDefaultOffice(
      tenantName,
      tenantId,
      setupData,
      user._id,
    );
  }

  @UseGuards(JwtGuard)
  @Get('default')
  async getDefaultOffice(@Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;

    const office = await this.officesService.getDefaultOffice(tenantName);
    if (!office) {
      throw new NotFoundException(
        'No se encontró oficina default para este tenant',
      );
    }

    return office;
  }

  @UseGuards(JwtGuard)
  @Patch('default')
  async updateDefaultOffice(
    @Req() request: Request,
    @Body() updateData: UpdateOfficeDto,
  ) {
    const user = (request as any).user;
    const tenantName = user.tenantName;

    return this.officesService.updateDefaultOffice(
      tenantName,
      updateData,
      user._id,
      user.tenantId,
    );
  }

  @Post()
  async create(@Body() createOfficeDto: CreateOfficeDto) {
    return this.officesService.create(createOfficeDto);
  }

  @Get()
  async findAll(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new NotFoundException('Missing tenantId in query params');
    }
    return this.officesService.findAllByTenant(new Types.ObjectId(tenantId));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.officesService.findById(new Types.ObjectId(id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOfficeDto: UpdateOfficeDto,
    @Req() req: any,
  ) {
    const userId = req.user?._id || 'system';

    return this.officesService.update(
      new Types.ObjectId(id),
      updateOfficeDto,
      userId,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.officesService.softDelete(new Types.ObjectId(id));
  }

  // ==================== SUPERADMIN ENDPOINTS ====================

  /**
   * Obtener oficinas por tenant (SuperAdmin only)
   */
  @Get('by-tenant/:tenantName')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async getOfficesByTenant(@Param('tenantName') tenantName: string) {
    return await this.officesService.findOfficesByTenant(tenantName);
  }

  /**
   * Obtener oficinas de múltiples tenants (SuperAdmin only)
   */
  @Post('by-tenants')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async getOfficesByTenants(@Body() body: GetOfficesByTenantsDto) {
    return await this.officesService.findAllOffices(body.tenantNames);
  }

  /**
   * Actualizar oficina cross-tenant (SuperAdmin only)
   */
  @Patch('cross-tenant/:tenantName/:officeId')
  @UseGuards(JwtGuard, SuperAdminGuard)
  async updateOfficeCrossTenant(
    @Param('tenantName') tenantName: string,
    @Param('officeId') officeId: string,
    @Body() updateData: UpdateOfficeDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user._id;
    return await this.officesService.updateOfficeCrossTenant(
      tenantName,
      officeId,
      updateData,
      userId,
    );
  }
}
