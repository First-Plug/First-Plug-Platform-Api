import { ObjectId } from 'mongoose';
import { Member, MemberDocument } from '../schemas/member.schema';

export interface IMembersService {
  findById(id: string | ObjectId): Promise<Member | null>;
  findProductBySerialNumber(serialNumber: string): Promise<any>;
  findByEmailNotThrowError(email: string): Promise<MemberDocument | null>;
  assignProduct(
    email: string,
    createProductDto: any,
    session?: any,
  ): Promise<Member | null>;
  getAllProductsWithMembers(): Promise<any[]>;
  getProductByMembers(id: string | ObjectId, session?: any): Promise<any>;
  findAll(): Promise<MemberDocument[]>;
  deleteProductFromMember(
    memberId: string,
    productId: string | ObjectId,
    session?: any,
  ): Promise<void>;
  validateSerialNumber(
    serialNumber: string,
    productId: string | ObjectId,
  ): Promise<boolean>;
  create(
    createMemberDto: any,
    userId: string,
    tenantName: string,
  ): Promise<Member>;
  bulkCreate(
    createMemberDto: any,
    userId: string,
    tenantName: string,
  ): Promise<Member[]>;
  softDeleteMember(id: string | ObjectId): Promise<MemberDocument>;
  notifyOffBoarding(
    member: any,
    products: any,
    tenantName: string,
  ): Promise<any>;
  findMembersByTeam(teamId: string | ObjectId): Promise<MemberDocument[]>;
  update(
    id: string | ObjectId,
    updateMemberDto: any,
    userId: string,
    tenantName: string,
  ): Promise<MemberDocument>;
}
