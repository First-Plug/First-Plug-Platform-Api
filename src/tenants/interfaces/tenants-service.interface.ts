export interface ITenantsService {
  findByEmail(email: string): Promise<any>;
  getByTenantName(tenantName: string): Promise<any>;
  findAllTenants(): Promise<any[]>;
  // etc.
}
