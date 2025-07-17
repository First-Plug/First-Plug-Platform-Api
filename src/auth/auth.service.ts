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
    console.log('🔐 Login iniciado:', loginDto.email);

    const user = await this.validateUser(loginDto);
    console.log('✅ Login exitoso:', user.email, '- Tipo:', {
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      tipo: user.tenantId ? 'NUEVO' : 'VIEJO',
    });

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
    // Buscar usuario enriquecido con datos del tenant
    const enrichedUser =
      await this.userEnrichmentService.findEnrichedUserByEmail(loginDto.email);

    if (!enrichedUser) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Validar permisos según el rol del usuario
    const isOldUser = !enrichedUser.tenantId && enrichedUser.tenantName;
    const isNewUser = !!enrichedUser.tenantId;
    const isSuperAdmin = enrichedUser.role === 'superadmin';

    console.log('🔍 Validando acceso:', {
      email: enrichedUser.email,
      role: enrichedUser.role || 'user',
      isOldUser,
      isNewUser,
      isSuperAdmin,
      tenantName: enrichedUser.tenantName,
      hasTenantId: !!enrichedUser.tenantId,
    });

    // SuperAdmin no necesita tenant
    if (isSuperAdmin) {
      console.log('👑 SuperAdmin detectado - acceso sin tenant');
      return enrichedUser;
    }

    // Usuarios normales necesitan tenant
    if (!isOldUser && !isNewUser) {
      console.log('❌ Usuario sin tenant asignado:', enrichedUser.email);
      throw new UnauthorizedException(
        'Usuario sin tenant asignado. Contacte al administrador.',
      );
    }

    const authorized = await this.validatePassword(
      { salt: enrichedUser.salt, password: enrichedUser.password },
      loginDto.password,
    );

    if (authorized) {
      return enrichedUser;
    }

    throw new UnauthorizedException('Credenciales inválidas');
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
      _id: user._id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role || 'user', // Incluir rol en el JWT
      tenantId: user.tenantId ? user.tenantId.toString() : null, // Convertir ObjectId a string
      tenantName: user.tenantName,
      address: user.address || '',
      apartment: user.apartment || '',
      city: user.city || '',
      state: user.state || '',
      country: user.country || '',
      zipCode: user.zipCode || '',
      phone: user.phone || '',
      accountProvider: user.accountProvider,
      isRecoverableConfig: user.isRecoverableConfig,
      computerExpiration: user.computerExpiration,
      widgets: user.widgets,
    };

    console.log('📦 Payload del JWT:', {
      email: payload.email,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      role: payload.role,
      widgetsCount: payload.widgets?.length || 0,
      widgets:
        payload.widgets?.map((w: any) => ({ id: w.id, order: w.order })) || [],
    });

    return payload;
  }
}
