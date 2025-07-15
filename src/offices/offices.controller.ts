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
} from '@nestjs/common';
import { Types } from 'mongoose';
import { OfficesService } from './offices.service';
import { CreateOfficeDto, UpdateOfficeDto } from './dto';
import { NotFoundException } from '@nestjs/common';

@Controller('offices')
export class OfficesController {
  constructor(private readonly officesService: OfficesService) {}

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
    const ourOfficeEmail = req.user?.email || 'office@example.com';

    return this.officesService.update(
      new Types.ObjectId(id),
      updateOfficeDto,
      userId,
      ourOfficeEmail,
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.officesService.softDelete(new Types.ObjectId(id));
  }
}
