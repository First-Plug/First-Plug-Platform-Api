import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByProviderDto } from './dto/create-user-by-provider.dto';
import { UpdateUserConfigDto } from './dto/update-user-config.dto';
import { AssignTenantToUsersDto } from './dto/assign-tenant-to-users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('provider')
  async createByProvider(@Body() dto: CreateUserByProviderDto) {
    return this.usersService.createByProvider(dto);
  }

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
}
