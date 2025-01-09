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

@Controller('products')
@UseGuards(JwtGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
    const { userId } = req;
    const tenantName = req.user.tenantName;
    const products = await this.productsService.bulkCreate(
      createProductDto,
      tenantName,
      userId,
    );

    res.status(HttpStatus.CREATED).json(products);
  }
  @Get('/migrate-price')
  async migratePriceForAllTenant() {
    return await this.productsService.migratePriceForAllTenant();
  }

  @Get('migrate-price/:tenantName')
  async migratePriceForTenant(@Param('tenantName') tenantName: string) {
    return await this.productsService.migratePriceForTenant(tenantName);
  }
  @Get('/table')
  getProductsTable() {
    return this.productsService.tableGrouping();
  }

  @Get('/assign/:id')
  getProductForAssign(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.productsService.getProductForAssign(id);
  }

  @Get('/reassign/:id')
  getProductForReassign(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.productsService.getProductForReassign(id);
  }

  @Get('/export-csv')
  async exportProductsCsv(@Res() res: Response) {
    await this.productsService.exportProductsCsv(res);
  }

  @Patch('/reassign/:id')
  reassignProduct(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    return this.productsService.reassignProduct(
      id,
      updateProductDto,
      tenantName,
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
    return this.productsService.update(id, updateProductDto, tenantName);
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
    const { userId } = req;
    return await this.productsService.softDelete(id, userId);
  }
}
