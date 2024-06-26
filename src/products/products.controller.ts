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
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('/bulkcreate')
  async bulkcreate(
    @Body() createProductDto: CreateProductArrayDto,
    @Res() res: Response,
  ) {
    const products = await this.productsService.bulkCreate(createProductDto);

    res.status(HttpStatus.CREATED).json(products);
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

  @Patch('/reassign/:id')
  reassignProduct(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.reassignProduct(id, updateProductDto);
  }

  @Get(':id')
  findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    return this.productsService.softDelete(id);
  }
}
