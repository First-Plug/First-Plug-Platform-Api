import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import {
  Shipment,
  ShipmentDocument,
  ShipmentSchema,
} from './schemas/shipment.schema';

import { Product, ProductDocument } from 'src/products/schemas/product.schema';
import { MemberModel, MembersService } from 'src/members/members.service';
import { ProductModel, ProductsService } from 'src/products/products.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { countryCodes } from './helpers/countryCodes';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { ShipmentMetadata } from 'src/shipments/schemas/shipment-metadata.schema';
import { ShipmentStatus } from 'src/shipments/interfaces/shipment.interface';

// import { ShipmentStatus } from 'src/shipments/interfaces/shipment.interface';
export interface ShipmentModel extends Model<ShipmentDocument> {}

@Injectable()
export class ShipmentsService {
  constructor(
    @Inject('SHIPMENT_MODEL')
    private readonly shipmentRepository: ShipmentModel,

    @Inject('SHIPMENT_METADATA_MODEL')
    private readonly shipmentMetadataRepository: Model<ShipmentMetadata>,

    @Inject('PRODUCT_MODEL')
    private readonly productRepository: ProductModel,

    @Inject('MEMBER_MODEL')
    private readonly memberRepository: MemberModel,

    private readonly tenantsService: TenantsService,
    private readonly connectionService: TenantConnectionService,

    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,

    private readonly membersService: MembersService,
  ) {
    console.log(
      '📡 connectionService en constructor:',
      !!this.connectionService,
    );
    console.log(
      '📡 Métodos disponibles en connectionService:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(this.connectionService)),
    );
    console.log(
      '🔎 cancelShipmentAndUpdateProductStatus typeof:',
      typeof this.cancelShipmentAndUpdateProductStatus,
    );
    console.log(
      '🔎 cancelShipmentAndUpdateProductStatus === prototype:',
      this.cancelShipmentAndUpdateProductStatus ===
        ShipmentsService.prototype.cancelShipmentAndUpdateProductStatus,
    );
    console.log('🧪 ShipmentService created');
    console.log('🧪 this.connectionService:', this.connectionService);
    if (!this.connectionService?.getTenantConnection) {
      throw new Error(
        '🚨 El método getTenantConnection NO existe en TenantConnectionService',
      );
    }
  }

  public getCountryCode(countryName: string): string {
    return countryCodes[countryName] || 'XX';
  }

  async getLocationCode(
    location: string,
    assignedEmail?: string,
  ): Promise<string> {
    const locationMap: Record<string, string> = {
      'FP warehouse': 'FP',
      'Our office': 'OO',
    };

    if (locationMap[location]) {
      return locationMap[location];
    }

    if (location === 'Employee' && assignedEmail) {
      const member =
        await this.membersService.findByEmailNotThrowError(assignedEmail);
      if (member && member.country) {
        return this.getCountryCode(member.country);
      }
    }
    return 'XX';
  }

  private getLocationName(location: string, assignedMember: string): string {
    if (location === 'Employee') return assignedMember;
    return location;
  }

  async getLocationDetails(
    location: string,
    tenantId: string,
    assignedEmail?: string,
  ): Promise<Record<string, string> | undefined> {
    if (location === 'FP warehouse') {
      return undefined;
    }

    if (location === 'Our office') {
      const tenant = await this.tenantsService.getTenantById(tenantId);
      if (!tenant)
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);

      return {
        address: tenant.address || '',
        apartment: tenant.apartment || '',
        city: tenant.city || '',
        state: tenant.state || '',
        country: tenant.country || '',
        zipCode: tenant.zipCode || '',
        phone: tenant.phone || '',
      };
    }

    if (location === 'Employee' && assignedEmail) {
      const member = await this.memberRepository.findOne({
        email: assignedEmail,
      });
      if (!member) {
        throw new NotFoundException(
          `Member with email ${assignedEmail} not found`,
        );
      }

      const memberDetails = {
        address: member.address || '',
        city: member.city || '',
        country: member.country || '',
        zipCode: member.zipCode || '',
        apartment: member.apartment || '',
        contactName: `${member.firstName} ${member.lastName}`,
        phone: member.phone || '',
        personalEmail: `${member.personalEmail || ''}`,
        dni: `${member.dni || ''}`,
      };

      console.log(
        '📍 DestinationDetails del member recuperado:',
        memberDetails,
      );
      return memberDetails;
    }
  }

  async getProductLocationData(
    productId: Product | string,
    actionType?: string,
  ): Promise<{
    product: Product;
    origin: string;
    destination: string;
    orderOrigin: string;
    orderDestination: string;
    assignedEmail: string;
  }> {
    const productIdStr =
      typeof productId === 'string' ? productId : productId._id?.toString();

    if (!productIdStr) {
      throw new BadRequestException(`Invalid product ID`);
    }
    let product: Product | null =
      await this.productRepository.findById(productIdStr);

    let assignedEmail = '';

    if (!product) {
      const memberWithProduct = await this.memberRepository.findOne({
        'products._id': productIdStr,
      });

      if (memberWithProduct) {
        const foundProduct = memberWithProduct.products.find(
          (p) => p._id?.toString() === productIdStr,
        );
        if (foundProduct) {
          product = this.productRepository.hydrate(foundProduct);
          assignedEmail = memberWithProduct.email;
        }
      }
    } else {
      assignedEmail = product.assignedEmail || '';
    }

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const isCreating = this.isCreatingAction(actionType);
    const origin = isCreating
      ? ''
      : this.getLocationName(
          product.location ?? '',
          product.assignedMember ?? '',
        );
    const destination = this.getLocationName(
      product.location ?? '',
      product.assignedMember ?? '',
    );

    const orderOrigin = isCreating
      ? 'XX'
      : await this.getLocationCode(
          product.location ?? 'Unknown',
          assignedEmail,
        );
    const orderDestination = await this.getLocationCode(
      product.location ?? 'Unknown',
      product.assignedEmail,
    );

    return {
      product,
      origin,
      destination,
      orderOrigin,
      orderDestination,
      assignedEmail: assignedEmail || '',
    };
  }

  private async getNextOrderNumber(): Promise<number> {
    const metadata = await this.shipmentMetadataRepository.findOne({});

    if (!metadata) {
      return 1;
    }

    return metadata.lastOrderNumber + 1;
  }

  async generateOrderId(
    orderOrigin: string,
    orderDestination: string,
    orderNumber: number,
  ): Promise<string> {
    const orderNumberFormatted = String(orderNumber).padStart(4, '0');
    return `${orderOrigin}${orderDestination}${orderNumberFormatted}`;
  }

  private isCreatingAction(actionType?: string): boolean {
    console.log('🧠 isCreatingAction llamado con:', actionType);
    return actionType === 'create' || actionType === 'bulkCreate';
  }

  async findById(shipmentId: string) {
    return this.shipmentRepository.findById(shipmentId);
  }

  async findOrCreateShipment(
    productId: string,
    origin: string,
    destination: string,
    orderOrigin: string,
    orderDestination: string,
    actionType: string,
    tenantId?: string,
    session: mongoose.ClientSession | null = null,
    assignedEmail?: string,
  ): Promise<Shipment> {
    if (!destination) {
      throw new BadRequestException('Destination is required');
    }

    if (orderOrigin === 'XX' && !this.isCreatingAction(actionType)) {
      throw new BadRequestException('Origin cannot be XX outside of creation');
    }

    if (!origin || origin === '') {
      origin = 'XX';
    }

    let product: Product | null =
      await this.productRepository.findById(productId);

    if (!product) {
      const memberWithProduct = await this.memberRepository.findOne({
        'products._id': productId,
      });

      if (memberWithProduct) {
        const foundProduct = memberWithProduct.products.find(
          (p) => p._id?.toString() === productId,
        );

        if (foundProduct) {
          product = this.productRepository.hydrate(foundProduct);
          assignedEmail = assignedEmail || memberWithProduct.email;
        }
      }
    }

    if (!product || !product._id) {
      throw new NotFoundException(
        `Product with ID ${productId} not found in any collection`,
      );
    }

    if (!assignedEmail) {
      assignedEmail = product.assignedEmail || '';
    }

    const productObjectId =
      product._id instanceof mongoose.Types.ObjectId
        ? product._id
        : new mongoose.Types.ObjectId(product._id.toString());
    console.log('📩 email recibido para shipment location:', assignedEmail);
    const originDetails = await this.getLocationDetails(
      origin,
      tenantId ?? '',
      assignedEmail,
    );

    const destinationLocationForDetails =
      destination === 'FP warehouse' || destination === 'Our office'
        ? destination
        : 'Employee';

    const destinationDetails = await this.getLocationDetails(
      destinationLocationForDetails,
      tenantId ?? '',
      assignedEmail,
    );

    const existingShipment = await this.shipmentRepository
      .findOne({
        origin,
        destination,
        shipment_status: 'In Preparation',
      })
      .session(session);

    if (existingShipment) {
      if (
        !existingShipment.products.some(
          (p) => p.toString() === productObjectId.toString(),
        )
      ) {
        existingShipment.products.push(productObjectId);
        existingShipment.quantity_products = existingShipment.products.length;
        await existingShipment.save();
      }
      return existingShipment;
    }

    const orderNumber = await this.getNextOrderNumber();

    const isCreating = this.isCreatingAction(actionType);

    const destinationIsComplete = await this.productsService.isAddressComplete(
      { ...product, location: product.location, assignedEmail },
      tenantId ?? '',
    );

    const originIsComplete = isCreating
      ? true
      : await this.productsService.isAddressComplete(
          { ...product, location: product.location, assignedEmail },
          tenantId ?? '',
        );

    const shipmentStatus =
      originIsComplete && destinationIsComplete
        ? 'In Preparation'
        : 'On Hold - Missing Data';

    const newShipment = await this.shipmentRepository.create({
      order_id: await this.generateOrderId(
        orderOrigin,
        orderDestination,
        orderNumber,
      ),
      quantity_products: 1,
      order_date: new Date(),
      shipment_type: 'TBC',
      trackingURL: '',
      shipment_status: shipmentStatus,
      price: { amount: null, currencyCode: 'TBC' },
      origin,
      originDetails,
      destination,
      destinationDetails,
      type: 'shipments',
      products: [productObjectId],
    });

    await this.shipmentMetadataRepository.findOneAndUpdate(
      {},
      { $set: { lastOrderNumber: orderNumber } },
      { upsert: true },
    );
    console.log('📦 Shipment creado:', newShipment);
    return newShipment;
  }

  async processBulkShipments(products: ProductDocument[], actionType: string) {
    console.log(`📦 Iniciando procesamiento de envíos...`);

    const shipmentGroups = new Map<
      string,
      {
        products: ProductDocument[];
        orderOrigin: string;
        orderDestination: string;
      }
    >();

    for (const product of products) {
      if (!product.fp_shipment) continue;

      if (!product._id) {
        console.warn(`⚠️ Producto sin _id, se omite del shipment.`);
        continue;
      }
      try {
        console.log(
          `🔍 Obteniendo ubicación para el producto ${product._id}...`,
        );

        const { origin, destination, orderOrigin, orderDestination } =
          await this.getProductLocationData(product._id.toString(), actionType);
        console.log(
          `✅ Ubicación obtenida para ${product._id}: ${origin} → ${destination}`,
        );

        const groupKey = `${origin}-${destination}`;
        if (!shipmentGroups.has(groupKey)) {
          shipmentGroups.set(groupKey, {
            products: [],
            orderOrigin,
            orderDestination,
          });
        }

        shipmentGroups.get(groupKey)?.products.push(product);
      } catch (error) {
        console.error(
          `❌ Error al obtener ubicación del producto ${product._id}:`,
          error.message,
        );
      }
    }

    for (const {
      products: groupedProducts,
      orderOrigin,
      orderDestination,
    } of shipmentGroups.values()) {
      const firstProduct = groupedProducts.find((p) => p._id);

      if (!firstProduct || !firstProduct._id) {
        console.warn(`⚠️ No hay productos válidos en este grupo de shipment.`);
        continue;
      }

      const { origin, destination } = await this.getProductLocationData(
        firstProduct._id.toString(),
        actionType,
      );

      await this.shipmentRepository.findOne({
        origin,
        destination,
        shipment_status: 'In Preparation',
      });

      try {
        const { origin, destination } = await this.getProductLocationData(
          firstProduct._id.toString(),
          actionType,
        );

        await this.findOrCreateShipment(
          firstProduct._id.toString(),
          origin,
          destination,
          orderOrigin,
          orderDestination,
          actionType,
        );
      } catch (error) {
        console.error(
          `❌ Error al crear/consolidar orden de shipment:`,
          error.message,
        );
      }
    }
  }

  async findProductsInAllCollections(
    productIds: string[],
  ): Promise<ProductDocument[]> {
    console.log(`🔍 Buscando productos en ambas colecciones...`);

    const productsFromCollection = await this.productRepository.find({
      _id: { $in: productIds },
    });

    const productsFromMembers: ProductDocument[] = [];
    for (const productId of productIds) {
      const memberWithProduct = await this.memberRepository.findOne({
        'products._id': productId,
      });

      if (memberWithProduct) {
        const foundProduct = memberWithProduct.products.find(
          (p) => p._id?.toString() === productId,
        );
        if (foundProduct) {
          const hydratedProduct = new this.productRepository(foundProduct);
          productsFromMembers.push(hydratedProduct);
        }
      }
    }

    const allProducts = [...productsFromCollection, ...productsFromMembers];
    console.log(
      `✅ Productos encontrados: ${allProducts.length} de ${productIds.length}`,
    );

    return allProducts;
  }

  async cancelShipmentAndUpdateProductStatus(
    shipmentId: string,
    tenantName: string,
  ): Promise<Shipment> {
    console.log('🔍 Entró al método cancelShipmentAndUpdateProductStatus');
    console.log(
      '🧠 Dentro del método, this.connectionService:',
      this.connectionService,
    );
    console.log(
      '🧠 typeof this.connectionService:',
      typeof this.connectionService,
    );
    console.log(
      '🧠 typeof this.connectionService.getTenantConnection:',
      typeof this.connectionService?.getTenantConnection,
    );
    console.log('🧠 ShipmentService this:', this);
    console.log(
      '🧠 ShipmentService this.constructor.name:',
      this.constructor.name,
    );

    console.log(
      '🔍 this instanceof ShipmentsService:',
      this instanceof ShipmentsService,
    );

    const connection =
      await this.connectionService.getTenantConnection(tenantName);

    const ShipmentModel =
      connection.models[Shipment.name] ??
      connection.model<ShipmentDocument>(Shipment.name, ShipmentSchema);

    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    if (
      shipment.shipment_status !== 'In Preparation' &&
      shipment.shipment_status !== 'On Hold - Missing Data'
    ) {
      throw new BadRequestException(
        `Shipment cannot be cancelled from status '${shipment.shipment_status}'`,
      );
    }

    shipment.shipment_status = 'Cancelled';
    await shipment.save();

    await this.updateProductsAfterShipmentEnd(shipment.products, tenantName);

    return shipment;
  }

  async markShipmentAsReceivedAndUpdateProductStatus(
    shipmentId: string,
    tenantName: string,
  ): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment not found');

    shipment.shipment_status = 'Received';
    await shipment.save();

    await this.updateProductsAfterShipmentEnd(shipment.products, tenantName);

    return shipment;
  }

  private async updateProductsAfterShipmentEnd(
    productIds: mongoose.Types.ObjectId[],
    tenantName: string,
  ): Promise<void> {
    const products = await this.findProductsInAllCollections(
      productIds.map((id) => id.toString()),
    );

    for (const product of products) {
      const newStatus = await this.productsService.determineProductStatus(
        product,
        tenantName,
      );

      product.status = newStatus;
      product.fp_shipment = false;

      if (product.assignedEmail) {
        await this.memberRepository.updateOne(
          { 'products._id': product._id },
          {
            $set: {
              'products.$.status': newStatus,
              'products.$.fp_shipment': false,
            },
          },
        );
      } else {
        await this.productRepository.updateOne(
          { _id: product._id },
          {
            $set: {
              status: newStatus,
              fp_shipment: false,
            },
          },
        );
      }
    }
  }

  async updateShipmentStatus(
    shipmentId: string,
    newStatus: ShipmentStatus,
  ): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findById(shipmentId);
    if (!shipment) throw new NotFoundException('Shipment not found');

    const statusChanged = shipment.shipment_status !== newStatus;
    shipment.shipment_status = newStatus;

    if (statusChanged && newStatus === 'On The Way') {
      const snapshots = await this.createSnapshotOnStatusChange(
        shipment.products,
      );
      shipment.snapshots = snapshots;
    }

    await shipment.save();
    return shipment;
  }

  private async createSnapshotOnStatusChange(
    productIds: mongoose.Types.ObjectId[],
  ): Promise<any[]> {
    const products = await this.findProductsInAllCollections(
      productIds.map((id) => id.toString()),
    );

    const snapshots = products.map((product) => ({
      _id: product._id!,
      name: product.name,
      category: product.category,
      attributes: product.attributes,
      status: product.status,
      recoverable: product.recoverable,
      serialNumber: product.serialNumber,
      assignedEmail: product.assignedEmail,
      assignedMember: product.assignedMember,
      lastAssigned: product.lastAssigned,
      acquisitionDate: product.acquisitionDate,
      location: product.location,
      price: product.price,
      additionalInfo: product.additionalInfo,
      productCondition: product.productCondition,
      fp_shipment: product.fp_shipment,
    }));

    return snapshots;
  }
}
