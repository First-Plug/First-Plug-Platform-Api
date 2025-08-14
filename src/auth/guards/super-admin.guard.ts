import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.role !== 'superadmin') {
      throw new ForbiddenException('Acceso denegado. Se requieren permisos de superadmin.');
    }

    console.log('👑 SuperAdmin autorizado:', user.email);
    return true;
  }
}
