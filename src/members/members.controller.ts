import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';
import { ObjectId } from 'mongoose';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CreateMemberArrayDto } from './dto/create-member-array.dto';
import { AddFullNameInterceptor } from './interceptors/add-full-name.interceptor';
import { ProductsService } from 'src/products/products.service';

@Controller('members')
@UseGuards(JwtGuard)
@UseInterceptors(AddFullNameInterceptor)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly productService: ProductsService,
  ) {}

  @Post()
  create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Post('/bulkcreate')
  async bulkcreate(
    @Body()
    createMemberDto: CreateMemberArrayDto,
  ) {
    return await this.membersService.bulkCreate(createMemberDto);
  }

  @Post('/offboarding/:id')
  async offboarding(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() data: any,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;

    const productsToUpdate: Array<{
      id: ObjectId;
      product: any;
    }> = [];

    data.forEach((element) => {
      const product = element.product;

      switch (element.relocation) {
        case 'New employee':
          product.assignedEmail = element.newMember.email;
          product.assignedMember = element.newMember.fullName;

          productsToUpdate.push({
            id: product._id,
            product,
          });
          break;

        case 'FP warehouse':
          product.assignedEmail = '';
          product.location = 'FP warehouse';
          product.status = 'Available';

          productsToUpdate.push({
            id: product._id,
            product,
          });
          break;

        case 'My office':
          product.assignedEmail = '';
          product.location = 'Our office';
          product.status = 'Available';

          productsToUpdate.push({
            id: product._id,
            product,
          });
          break;
      }
    });

    if (productsToUpdate.length > 0) {
      await this.productService.updateMultipleProducts(
        productsToUpdate,
        tenantName,
      );
    }

    const offboardingMember = await this.membersService.findById(id);

    await this.membersService.softDeleteMember(id);

    await this.membersService.notifyOffBoarding(offboardingMember, data);

    return { message: 'Offboarding process completed successfully' };
  }

  // @Post('/assign-many-products')
  // async assignManyProducts(
  //   @Body() assignManyProductsDto: AssignManyProductsDto,
  // ) {
  //   const { memberId, productsIds } = assignManyProductsDto;
  //   await this.membersService.assignManyProductsToMember(memberId, productsIds);
  // }

  @Get()
  findAll() {
    return this.membersService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.membersService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.membersService.softDeleteMember(id);
  }

  @Get('team/:teamId')
  async findMembersByTeam(@Param('teamId', ParseMongoIdPipe) teamId: ObjectId) {
    return await this.membersService.findMembersByTeam(teamId);
  }
  // already run this code, I leave it here for reference
  // @Get('update-dni-all-tenants')
  // async updateDniForAllTenants() {
  //   return await this.membersService.updateDniForAllTenants();
  // }
  // @Get('update-dni/:tenantName')
  // async updateDniForTenant(@Param('tenantName') tenantName: string) {
  //   return await this.membersService.updateDniForTenant(tenantName);
  // }
}
