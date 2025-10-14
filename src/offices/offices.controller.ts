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

    // 🔧 La oficina se crea automáticamente al crear la base de datos
    const office = await this.officesService.getDefaultOffice(tenantName);

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

  /**
   * Crear nueva oficina para el tenant del usuario autenticado
   */
  @UseGuards(JwtGuard)
  @Post()
  async create(
    @Body() createOfficeDto: CreateOfficeDto,
    @Req() request: Request,
  ) {
    const user = (request as any).user;
    const tenantName = user.tenantName;
    const tenantId = new Types.ObjectId(user.tenantId);

    return this.officesService.createOffice(
      tenantName,
      tenantId,
      createOfficeDto,
      user._id,
    );
  }

  /**
   * Obtener todas las oficinas del tenant del usuario autenticado
   */
  @UseGuards(JwtGuard)
  @Get()
  async findAll(@Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;

    const offices = await this.officesService.findAllByTenantName(tenantName);

    // Agregar información de estado para cada oficina
    const officesWithStatus = await Promise.all(
      offices.map(async (office) => {
        const hasAssignedProducts =
          await this.officesService.hasAssignedProducts(office._id, tenantName);
        const hasActiveShipments = await this.officesService.hasActiveShipments(
          office._id,
          tenantName,
        );

        return {
          ...office.toObject(),
          hasAssignedProducts,
          hasActiveShipments,
        };
      }),
    );

    return officesWithStatus;
  }

  /**
   * Obtener oficina específica por ID
   */
  @UseGuards(JwtGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;

    return this.officesService.findByIdAndTenant(
      new Types.ObjectId(id),
      tenantName,
    );
  }

  /**
   * Actualizar oficina específica
   */
  @UseGuards(JwtGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOfficeDto: UpdateOfficeDto,
    @Req() request: Request,
  ) {
    const user = (request as any).user;
    const tenantName = user.tenantName;
    const userId = user._id;

    return this.officesService.updateOffice(
      new Types.ObjectId(id),
      tenantName,
      updateOfficeDto,
      userId,
    );
  }

  /**
   * Marcar oficina como default (y desmarcar las demás)
   */
  @UseGuards(JwtGuard)
  @Patch(':id/toggle-default')
  async toggleDefault(@Param('id') id: string, @Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;
    const userId = user._id;

    return this.officesService.toggleDefaultOffice(
      new Types.ObjectId(id),
      tenantName,
      userId,
    );
  }

  /**
   * Soft delete de oficina (no se puede eliminar la default)
   */
  @UseGuards(JwtGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() request: Request) {
    const user = (request as any).user;
    const tenantName = user.tenantName;
    const userId = user._id;

    return this.officesService.softDeleteOffice(
      new Types.ObjectId(id),
      tenantName,
      userId,
    );
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
