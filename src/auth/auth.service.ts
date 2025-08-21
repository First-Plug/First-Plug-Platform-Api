import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/auth.dto';
import { UserEnrichmentService } from './user-enrichment.service';
import { genSalt, hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { CreateTenantByProvidersDto } from 'src/tenants/dto/create-tenant-by-providers.dto';
import { UserJWT } from './interfaces/auth.interface';
import { ChangePasswordDto } from './dto/change-password.dto';

const EXPIRE_TIME = 20 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private userEnrichmentService: UserEnrichmentService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    await this.checkAndPropagateTenantConfig(user);

    const payload = this.createUserPayload(user);

    return {
      user: payload,
      backendTokens: {
        accessToken: await this.jwtService.signAsync(payload, {
          expiresIn: '48h',
          secret: process.env.JWTSECRETKEY,
        }),

        refreshToken: await this.jwtService.signAsync(payload, {
          expiresIn: '7h',
          secret: process.env.JWTREFRESHTOKENKEY,
        }),
        expireIn: new Date().setTime(new Date().getTime()) * EXPIRE_TIME,
      },
    };
  }

  async checkAndPropagateTenantConfig(user: any) {
    // TODO: Implementar con la nueva arquitectura separada
    // Por ahora comentado para mantener compatibilidad
    if (!user.tenantName) {
      return;
    }

    // Esta funcionalidad necesita ser reimplementada con la nueva arquitectura
    // donde los datos del tenant y usuario están separados
    console.log(
      'checkAndPropagateTenantConfig: Funcionalidad temporalmente deshabilitada',
    );
    return;
  }

  async validateUser(loginDto: LoginDto) {
    // 1. PRIMERO: Buscar usuario por email
    const enrichedUser =
      await this.userEnrichmentService.findEnrichedUserByEmail(loginDto.email);

    if (!enrichedUser) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. SEGUNDO: Validar contraseña
    // Validar que el usuario tenga password y salt
    if (!enrichedUser.password || !enrichedUser.salt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const authorized = await this.validatePassword(
      { salt: enrichedUser.salt, password: enrichedUser.password },
      loginDto.password,
    );

    if (!authorized) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. TERCERO: Validar permisos según el rol del usuario
    const isOldUser = !enrichedUser.tenantId && enrichedUser.tenantName;
    const isNewUser = !!enrichedUser.tenantId;
    const isSuperAdmin = enrichedUser.role === 'superadmin';

    // SuperAdmin no necesita tenant
    if (isSuperAdmin) {
      return enrichedUser;
    }

    // 4. CUARTO: Usuarios normales necesitan tenant (DESPUÉS de validar credenciales)
    if (!isOldUser && !isNewUser) {
      // Error específico para usuarios sin tenant (credenciales correctas)
      const error = new UnauthorizedException(
        'Usuario sin tenant asignado. Contacte al administrador.',
      );
      (error as any).code = 'NO_TENANT_ASSIGNED';
      throw error;
    }

    return enrichedUser;
  }

  async getTokens(createTenantByProvidersDto: CreateTenantByProvidersDto) {
    const enrichedUser =
      await this.userEnrichmentService.findEnrichedUserByEmail(
        createTenantByProvidersDto.email,
      );

    if (enrichedUser) {
      const payload = this.createUserPayload(enrichedUser);

      return {
        user: payload,
        backendTokens: {
          accessToken: await this.jwtService.signAsync(payload, {
            expiresIn: '48h',
            secret: process.env.JWTSECRETKEY,
          }),

          refreshToken: await this.jwtService.signAsync(payload, {
            expiresIn: '7h',
            secret: process.env.JWTREFRESHTOKENKEY,
          }),
          expireIn: new Date().setTime(new Date().getTime()) * EXPIRE_TIME,
        },
      };
    }
    throw new UnauthorizedException('User not found');
  }

  async refreshToken(user: any) {
    const enrichedUser =
      await this.userEnrichmentService.findEnrichedUserByEmail(user.email);
    if (!enrichedUser) {
      throw new UnauthorizedException();
    }
    const payload = this.createUserPayload(enrichedUser);

    return {
      user: payload,
      backendTokens: {
        accessToken: await this.jwtService.signAsync(payload, {
          expiresIn: '48h',
          secret: process.env.JWTSECRETKEY,
        }),

        refreshToken: await this.jwtService.signAsync(payload, {
          expiresIn: '7h',
          secret: process.env.JWTREFRESHTOKENKEY,
        }),

        expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
      },
    };
  }

  async changePassword(user: UserJWT, changePasswordDto: ChangePasswordDto) {
    const enrichedUser =
      await this.userEnrichmentService.findEnrichedUserByEmail(user.email);

    if (!enrichedUser) {
      throw new UnauthorizedException('User not found');
    }

    const userPassword = {
      password: enrichedUser.password,
      salt: enrichedUser.salt,
    };

    await this.validatePassword(
      userPassword,
      changePasswordDto.oldPassword,
      false,
    );

    const salt = await genSalt(10);
    const hashedPassword = await hash(changePasswordDto.newPassword, salt);

    // Actualizar la contraseña en la colección de usuarios
    return await this.userEnrichmentService.updateUserConfig(user._id, {
      password: hashedPassword,
      salt,
    });
  }

  async validatePassword(
    user: { salt?: string; password?: string },
    password: string,
    throwError: boolean = true,
  ) {
    const hashedPassword = await hash(password, user.salt!);

    if (user.password !== hashedPassword) {
      if (throwError) {
        throw new UnauthorizedException(
          `The credentials are not valid, please try again.`,
        );
      }

      throw new BadRequestException(
        'The password provided is not valid, please try again.',
      );
    }

    return user.password === hashedPassword;
  }

  private createUserPayload(user: any) {
    const payload = {
      // Datos esenciales del usuario
      _id: user._id,
      email: user.email,
      firstName: user.firstName || user.name?.split(' ')[0] || '', // Compatibilidad con usuarios viejos
      lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
      role: user.role || 'user',
      image: user.image || '',
      accountProvider: user.accountProvider,

      // Datos del tenant (esenciales)
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      tenantName: user.tenantName,

      // Configuración del tenant (mantener en JWT)
      isRecoverableConfig: user.isRecoverableConfig,
      computerExpiration: user.computerExpiration,

      // Datos del usuario (mantener en JWT)
      widgets: user.widgets || [],

      // ✅ MIGRACIÓN COMPLETA - Solo datos esenciales en JWT
    };

    return payload;
  }
}
