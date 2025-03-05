import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import { Shipment } from './schemas/shipment.schema';
import { ShipmentMetadata } from 'src/shipments/schemas/shipment-metadata.schema';
import { Member } from 'src/members/schemas/member.schema';
import { Product } from 'src/products/schemas/product.schema';

@Injectable()
export class ShipmentsService {
  constructor(
    @Inject('SHIPMENT_MODEL') private shipmentRepository: Model<Shipment>,
    @Inject('SHIPMENT_METADATA_MODEL')
    private shipmentMetadataRepository: Model<ShipmentMetadata>,
    @Inject('PRODUCT_MODEL') private productRepository: Model<Product>,
    @Inject('MEMBER_MODEL') private memberRepository: Model<Member>,
  ) {}

  // private getLocationCode(location: string): string {
  //   const locationMap: Record<string, string> = {
  //     'FP warehouse': 'FP',
  //     'Our office': 'OO',
  //     Employee: 'EM',
  //   };

  //   return locationMap[location] || 'XX';
  // }

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
    return actionType === 'create' || actionType === 'bulkCreate';
  }

  async findOrCreateShipment(
    productId: string,
    origin: string,
    destination: string,
    orderOrigin: string,
    orderDestination: string,
    actionType: string,
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

    //  Si el producto no está en `products`, buscarlo en `members.products`
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
        }
      }
    }

    // Si el producto no existe en ninguna colección, lanzar error
    if (!product || !product._id) {
      throw new NotFoundException(
        `Product with ID ${productId} not found in any collection`,
      );
    }

    // Asegurar que `product._id` es un ObjectId válido
    const productObjectId =
      product._id instanceof mongoose.Types.ObjectId
        ? product._id
        : new mongoose.Types.ObjectId(product._id.toString());

    // Buscar si existe una orden en estado "In Preparation"
    const existingShipment = await this.shipmentRepository.findOne({
      origin,
      destination,
      shipment_status: 'In Preparation',
    });

    // Si existe, consolida
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

    // Si no existe, crear una nueva orden de envío
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
      shipment_status: 'In Preparation',
      price: { amount: null, currencyCode: 'TBC' },
      origin,
      destination,
      type: 'shipments',
      products: [productObjectId],
    });

    await this.shipmentMetadataRepository.findOneAndUpdate(
      {},
      { $set: { lastOrderNumber: orderNumber } },
      { upsert: true },
    );

    return newShipment;
  }
}
