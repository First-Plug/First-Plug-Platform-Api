import { FilterQuery, ObjectId, Query } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { MemberDocument } from 'src/members/schemas/member.schema';
import { Status } from 'src/products/interfaces/product.interface';

export interface IProductsService {
  findProductById(productId: string | ObjectId): Promise<{
    product: Product;
    member?: MemberDocument;
  } | null>;
  isAddressComplete(product: Product, tenantId: string): any;
  determineProductStatus(
    product: Partial<Product>,
    tenantId: string,
    assignedMember?: string,
    origin?: string,
  ): Promise<Status>;
  find(
    filter: FilterQuery<ProductDocument>,
  ): Query<ProductDocument[], ProductDocument>;
  deleteOne(filter: FilterQuery<ProductDocument>): Query<any, ProductDocument>;
  updateMultipleProducts(
    productsToUpdate: { id: ObjectId; product: any }[],
    tenantName: string,
    userId: string,
  ): Promise<ProductDocument[]>;
}
