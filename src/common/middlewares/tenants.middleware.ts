import {
  Injectable,
  NestMiddleware,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TenantsService } from 'src/tenants/tenants.service';

@Injectable()
export class TenantsMiddleware implements NestMiddleware {
  constructor(
    private tenantsService: TenantsService,
    private jwtService: JwtService,
  ) {}

  async use(req: Request, res: any, next: () => void) {
    const token = this.extractTokenFromHeader(req);

    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWTSECRETKEY,
      });

      const { tenantName } = payload;

      const tenantExits = await this.tenantsService.getByTenantName(tenantName);

      if (!tenantExits) {
        throw new NotFoundException('Tenant does not exist');
      }

      req['tenantName'] = tenantName;
      req['userId'] = payload._id;
      next();
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
