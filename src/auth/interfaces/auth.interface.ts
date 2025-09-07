import { ObjectId } from 'mongoose';
import { Provider } from 'src/tenants/schemas/tenant.schema';

export type UserJWT = {
  _id: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  image?: string;
  accountProvider: Provider;

  // Datos del tenant
  tenantId: string | null;
  tenantName: string;

  // Configuración del tenant (mantener en JWT)
  isRecoverableConfig?: any;
  computerExpiration?: number;

  // Datos del usuario
  widgets?: any[];
};

export type validatePassword = {
  password: string;
  salt: string;
};
