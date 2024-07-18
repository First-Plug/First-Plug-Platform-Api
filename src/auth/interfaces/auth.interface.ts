import { ObjectId } from 'mongoose';
import { Provider } from 'src/tenants/schemas/tenant.schema';

export type UserJWT = {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string;
  tenantName: string;
  accountProvider: Provider;
};

export type validatePassword = {
  password: string;
  salt: string;
};
