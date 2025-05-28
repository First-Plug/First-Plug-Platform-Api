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
  Req,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';
import { ObjectId } from 'mongoose';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CreateMemberArrayDto } from './dto/create-member-array.dto';
import { AddFullNameInterceptor } from './interceptors/add-full-name.interceptor';
import { ProductsService } from 'src/products/products.service';
import { HistoryService } from 'src/history/history.service';
import { ShipmentsService } from 'src/shipments/shipments.service';

@Controller('members')
@UseGuards(JwtGuard)
@UseInterceptors(AddFullNameInterceptor)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly productService: ProductsService,
    private readonly historyService: HistoryService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @Post()
  async create(@Body() createMemberDto: CreateMemberDto, @Req() req) {
    const { userId, tenantName } = req;

    return await this.membersService.create(
      createMemberDto,
      userId,
      tenantName,
    );
  }

  @Post('/bulkcreate')
  async bulkcreate(
    @Body()
    createMemberDto: CreateMemberArrayDto,
    @Req() req,
  ) {
    const { userId, tenantName } = req;
    return await this.membersService.bulkCreate(
      createMemberDto,
      userId,
      tenantName,
    );
  }

  @Post('/offboarding/:id')
  async offboarding(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() data: any,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const { userId } = req;
    const ourOfficeEmail = req.user.email;

    const productsToUpdate: Array<{
      id: ObjectId;
      product: any;
    }> = [];

    type ProductOffboardingData = {
      productId: ObjectId;
      newLocation: string;
      assignedEmail: string;
      assignedMember: string;
    };

    type NewOffboardingData = {
      products: ProductOffboardingData[];
    };

    const newData: NewOffboardingData = {
      products: [],
    };

    data.forEach((element) => {
      const product = element.product;

      switch (element.relocation) {
        case 'New employee': {
          product.assignedEmail = element.newMember.email;
          product.assignedMember = element.newMember.fullName;

          product.fp_shipment = element.fp_shipment;
          product.actionType = 'offboarding';

          const desirableDate = element.desirableDate;

          if (typeof desirableDate === 'string') {
            product.desirableDate = desirableDate;
          } else if (typeof desirableDate === 'object') {
            product.desirableDate = {
              origin: desirableDate.origin,
              destination: desirableDate.destination,
            };
          }
          console.log('🟡 Producto recibido en offboarding:', {
            fp_shipment: element.fp_shipment,
            desirableDate: element.desirableDate,
            relocation: element.relocation,
            assignedEmail: element.newMember?.email || '',
          });

          productsToUpdate.push({
            id: product._id,
            product,
          });

          // Agregar al newData
          newData.products.push({
            productId: product._id,
            newLocation: 'New employee',
            assignedEmail: product.assignedEmail,
            assignedMember: product.assignedMember,
          });
          break;
        }
        case 'FP warehouse': {
          product.lastAssigned = product.assignedEmail;
          product.assignedEmail = '';
          product.assignedMember = '';
          product.location = 'FP warehouse';
          product.status = 'Available';

          product.fp_shipment = element.fp_shipment;
          product.actionType = 'offboarding';

          const desirableDate = element.desirableDate;

          if (typeof desirableDate === 'string') {
            product.desirableDate = desirableDate;
          } else if (typeof desirableDate === 'object') {
            product.desirableDate = {
              origin: desirableDate.origin,
              destination: desirableDate.destination,
            };
          }
          console.log('🟡 Producto recibido en offboarding:', {
            fp_shipment: element.fp_shipment,
            desirableDate: element.desirableDate,
            relocation: element.relocation,
            assignedEmail: element.newMember?.email || '',
          });
          productsToUpdate.push({
            id: product._id,
            product,
          });

          // Agregar al newData
          newData.products.push({
            productId: product._id,
            newLocation: 'FP warehouse',
            assignedEmail: '',
            assignedMember: '',
          });
          break;
        }
        case 'My office': {
          product.lastAssigned = product.assignedEmail;
          product.assignedEmail = '';
          product.assignedMember = '';
          product.location = 'Our office';
          product.status = 'Available';

          product.fp_shipment = element.fp_shipment;
          product.actionType = 'offboarding';

          const desirableDate = element.desirableDate;

          if (typeof desirableDate === 'string') {
            product.desirableDate = desirableDate;
          } else if (typeof desirableDate === 'object') {
            product.desirableDate = {
              origin: desirableDate.origin,
              destination: desirableDate.destination,
            };
          }
          console.log('🟡 Producto recibido en offboarding:', {
            fp_shipment: element.fp_shipment,
            desirableDate: element.desirableDate,
            relocation: element.relocation,
            assignedEmail: element.newMember?.email || '',
          });
          productsToUpdate.push({
            id: product._id,
            product,
          });

          // Agregar al newData
          newData.products.push({
            productId: product._id,
            newLocation: 'Our office',
            assignedEmail: '',
            assignedMember: '',
          });
          break;
        }
      }
    });

    if (productsToUpdate.length > 0) {
      await this.productService.updateMultipleProducts(
        productsToUpdate,
        tenantName,
        userId,
        ourOfficeEmail,
      );
    }

    const updatedProducts = productsToUpdate.map((p) => p.product);

    const offboardingMember = await this.membersService.findById(
      id,
      tenantName,
    );

    await this.membersService.softDeleteMember(id, tenantName, true);

    await this.membersService.notifyOffBoarding(
      offboardingMember,
      data,
      tenantName,
    );

    const assignedEmail = offboardingMember.email;

    await this.historyService.create({
      actionType: 'offboarding',
      itemType: 'members',
      userId: userId,
      changes: {
        oldData: {
          ...offboardingMember,
          products: [
            ...offboardingMember.products.map((product) => ({
              ...product,
              lastAssigned: assignedEmail,
            })),
            ...updatedProducts,
          ],
        },
        newData: newData,
      },
    });

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
  findAll(@Req() req): Promise<any> {
    const { tenantName } = req.user;
    return this.membersService.findAll(tenantName);
  }

  @Get(':id')
  findById(@Param('id', ParseMongoIdPipe) id: ObjectId, @Req() req) {
    const { tenantName } = req;
    return this.membersService.findById(id, tenantName);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateMemberDto: UpdateMemberDto,
    @Req() req,
  ) {
    const { userId, tenantName } = req;
    const ourOfficeEmail = req.user.email;
    return this.membersService.update(
      id,
      updateMemberDto,
      userId,
      tenantName,
      ourOfficeEmail,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseMongoIdPipe) id: ObjectId, @Req() req) {
    const { userId, tenantName } = req;

    const memberDeleted = await this.membersService.softDeleteMember(
      id,
      tenantName,
    );

    await this.historyService.create({
      actionType: 'delete',
      itemType: 'members',
      userId: userId,
      changes: {
        oldData: memberDeleted,
        newData: null,
      },
    });

    return memberDeleted;
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
