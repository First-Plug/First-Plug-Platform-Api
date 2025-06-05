import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { UpdateProductDto } from './dto/update-product.dto';
import { Response } from 'express';
import { ObjectId } from 'mongoose';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CreateProductArrayDto } from './dto/create-product-array.dto';
import { AssignmentsService } from 'src/assigments/assigments.service';

@Controller('products')
@UseGuards(JwtGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @Request() req: any) {
    const tenantName = req.user.tenantName;
    const { userId } = req;
    return this.productsService.create(createProductDto, tenantName, userId);
  }

  @Post('/bulkcreate')
  async bulkcreate(
    @Body() createProductDto: CreateProductArrayDto,
    @Res() res: Response,
    @Request() req: any,
  ) {
    try {
      const tenantName = req.user.tenantName;
      const { userId } = req;
      const products = await this.productsService.bulkCreate(
        createProductDto,
        tenantName,
        userId,
      );

      res.status(HttpStatus.CREATED).json(products);
    } catch (error) {
      console.error('Error en bulkcreate:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al crear productos',
        error: error.message,
      });
    }
  }

  // @Get('/migrate-price')
  // async migratePriceForAllTenant() {
  //   return await this.productsService.migratePriceForAllTenant();
  // }

  // @Get('migrate-price/:tenantName')
  // async migratePriceForTenant(@Param('tenantName') tenantName: string) {
  //   return await this.productsService.migratePriceForTenant(tenantName);
  // }

  @Get('/table')
  getProductsTable(tenantName: string) {
    return this.productsService.tableGrouping(tenantName);
  }

  @Get('/assign/:id')
  getProductForAssign(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.assignmentsService.getProductForAssign(id);
  }

  @Get('/reassign/:id')
  getProductForReassign(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.assignmentsService.getProductForReassign(id);
  }

  @Get('/export-csv')
  async exportProductsCsv(@Res() res: Response, @Request() req: any) {
    await this.productsService.exportProductsCsv(res, req.user.tenantName);
  }

  @Patch('/reassign/:id')
  reassignProduct(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const { userId } = req;
    const ourOfficeEmail = req.user.email;
    return this.productsService.reassignProduct(
      id,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
    );
  }

  @Get(':id')
  findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const { userId } = req;
    const ourOfficeEmail = req.user.email;
    return this.productsService.update(
      id,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
    );
  }

  @Patch('/entity/:id')
  updateEntity(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: any,
  ) {
    const { userId } = req;
    const tenantName = req.user.tenantName;

    return this.productsService.updateEntity(id, updateProductDto, {
      tenantName,
      userId,
    });
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Request() req: any,
  ) {
    const { userId, tenantName } = req;
    return await this.productsService.softDelete(id, userId, tenantName);
  }
}
