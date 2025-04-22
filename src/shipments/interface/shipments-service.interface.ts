import { ClientSession } from 'mongoose';
import { MemberDocument } from 'src/members/schemas/member.schema';
import { ProductDocument } from 'src/products/schemas/product.schema';

export interface IShipmentsService {
  checkAndUpdateShipmentsForOurOffice(
    tenantName: string,
    oldAddress: any,
    newAddress: any,
  ): Promise<void>;
  findOrCreateShipmentsForOffboarding(
    products: ProductDocument[],
    tenantName: string,
    session: ClientSession,
    originMember: MemberDocument,
    desirableDateOrigin: string,
  ): Promise<any>;
  findOrCreateShipment(
    productId: string,
    actionType: string,
    tenantName: string,
    session: ClientSession,
    desirableDateDestination: string,
    desirableDateOrigin: string,
    oldData: any,
    newData: any,
  ): Promise<any>;
  getShipmentsByMember(memberEmail: string, tenantName: string): Promise<any[]>;
  getLocationInfo(
    location: string,
    tenantName: string,
    assignedEmail?: string,
    assignedMember?: string,
  ): Promise<any>;
  updateShipmentStatusAndProductsToInPreparation(
    shipmentId: any,
    tenantName: string,
  ): Promise<any>;
  cancelShipmentAndUpdateProducts(shipmentId: string, tenantName: string): any;
  updateProductOnShipmentReceived(
    productId: string,
    tenantName: string,
    origin: string,
  ): Promise<any>;
}
