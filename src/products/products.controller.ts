import {
  BadRequestException,
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
import { CreateProductCSVArrayDto } from './dto/create-product-csv-array.dto';
import { AssignmentsService } from 'src/assignments/assignments.service';
import { TenantModelRegistry } from 'src/infra/db/tenant-model-registry';

@Controller('products')
@UseGuards(JwtGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly assignmentsService: AssignmentsService,
    private readonly tenantModelRegistry: TenantModelRegistry,
  ) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto, @Request() req: any) {
    const tenantName = req.user.tenantName;
    const { userId } = req;

    // 🔍 DEBUG: Ver qué datos manda el front
    console.log('📦 [CREATE PRODUCT] Payload recibido del front:');
    console.log(JSON.stringify(createProductDto, null, 2));
    console.log('📦 [CREATE PRODUCT] Atributos:');
    console.log(JSON.stringify(createProductDto.attributes, null, 2));

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

      // 🔍 DEBUG: Ver qué datos manda el front
      console.log('📦 [BULK CREATE] Payload recibido del front:');
      console.log(JSON.stringify(createProductDto, null, 2));
      console.log(
        `📦 [BULK CREATE] Total de productos: ${createProductDto.length}`,
      );

      const products = await this.productsService.bulkCreate(
        createProductDto,
        tenantName,
        userId,
        { isCSVUpload: false },
      );

      res.status(HttpStatus.CREATED).json(products);
    } catch (error) {
      console.error('Error en bulkcreate UI:', error);

      // Si es un error de validación (BadRequestException o ZodError), devolver 400
      if (error instanceof BadRequestException || error.name === 'ZodError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Error de validación en los datos',
          error: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Error al crear productos',
          error: error.message,
        });
      }
    }
  }

  @Post('/bulkcreate-csv')
  async bulkcreateCSV(
    @Body() createProductDto: CreateProductCSVArrayDto | any,
    @Res() res: Response,
    @Request() req: any,
  ) {
    try {
      const tenantName = req.user.tenantName;
      const { userId } = req;

      // 🔍 DEBUG: Ver qué datos manda el front
      console.log('📦 [BULK CREATE CSV] Payload recibido del front:');
      console.log(JSON.stringify(createProductDto, null, 2));
      console.log(
        `📦 [BULK CREATE CSV] Total de productos: ${createProductDto.length}`,
      );

      const products = await this.productsService.bulkCreate(
        createProductDto as CreateProductDto[],
        tenantName,
        userId,
        { isCSVUpload: true }, // ✅ CSV Upload - habilitado con nuevos campos
      );

      res.status(HttpStatus.CREATED).json(products);
    } catch (error) {
      // Si es un error de validación (BadRequestException o ZodError), devolver 400
      if (error instanceof BadRequestException || error.name === 'ZodError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Error de validación en los datos del CSV',
          error: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Error al crear productos',
          error: error.message,
        });
      }
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
  getProductsTable(@Request() req: any) {
    const tenantName = req.user.tenantName;

    return this.productsService.tableGrouping(tenantName);
  }

  @Get('/assign/:id')
  getProductForAssign(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    tenantName: string,
  ) {
    console.log(`📦 Assign - Product ID: ${id} | Tenant: ${tenantName}`);
    return this.assignmentsService.getProductForAssign(id, tenantName);
  }

  @Get('/reassign/:id')
  async getProductForReassign(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const connection = await this.tenantModelRegistry.getConnection(tenantName);
    console.log(`📦 Reassign GET - Product ID: ${id} | Tenant: ${tenantName}`);
    return this.assignmentsService.getProductForReassign(
      id,
      tenantName,
      connection,
    );
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

    console.log(
      `🔁 Reassign PATCH - Product ID: ${id} | Tenant: ${tenantName} | User: ${userId}`,
    );
    console.log(
      '📦 updateProductDto recibido:',
      JSON.stringify(updateProductDto, null, 2),
    );
    console.log('🏢 ourOfficeEmail:', ourOfficeEmail);

    return this.productsService.reassignProduct(
      id,
      updateProductDto,
      tenantName,
      userId,
      ourOfficeEmail,
    );
  }

  @Get(':id')
  async getById(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const product = await this.productsService.findById(id, tenantName);
    return product;
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
