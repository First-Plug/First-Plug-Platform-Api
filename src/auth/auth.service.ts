import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/auth.dto';
import { TenantsService } from 'src/tenants/tenants.service';
import { genSalt, hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { CreateTenantByProvidersDto } from 'src/tenants/dto/create-tenant-by-providers.dto';
import { UserJWT } from './interfaces/auth.interface';
import { ChangePasswordDto } from './dto/change-password.dto';

const EXPIRE_TIME = 20 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private tenantService: TenantsService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    const {
      _id,
      email,
      name,
      image,
      tenantName,
      address,
      apartment,
      city,
      country,
      state,
      zipCode,
      phone,
      accountProvider,
    } = user;

    const payload = {
      _id,
      email,
      name,
      image,
      tenantName,
      address,
      apartment,
      city,
      country,
      state,
      zipCode,
      phone,
      accountProvider,
    };

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

  async validateUser(loginDto: LoginDto) {
    const user = await this.tenantService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException();
    }

    const authorized = await this.validatePassword(
      { salt: user.salt, password: user.password },
      loginDto.password,
    );

    if (authorized) {
      return user;
    }

    throw new UnauthorizedException();
  }

  async getTokens(createTenantByProvidersDto: CreateTenantByProvidersDto) {
    const user = await this.tenantService.findByEmail(
      createTenantByProvidersDto.email,
    );

    if (user) {
      const { _id, email, name, image, tenantName, accountProvider } = user;

      const payload = {
        _id,
        email,
        name,
        image,
        tenantName,
        accountProvider,
      };

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
  }

  async refreshToken(user: any) {
    const updatedUser = await this.tenantService.findByEmail(user.email);
    if (!updatedUser) {
      throw new UnauthorizedException();
    }
    const {
      _id,
      email,
      name,
      image,
      tenantName,
      address,
      apartment,
      city,
      country,
      state,
      zipCode,
      phone,
      accountProvider,
    } = updatedUser;

    const payload = {
      _id,
      email,
      name,
      image,
      tenantName,
      address,
      apartment,
      city,
      country,
      state,
      zipCode,
      phone,
      accountProvider,
    };

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
    const userFound = await this.tenantService.findByEmail(user.email);

    const userPassword = {
      password: userFound?.password,
      salt: userFound?.salt,
    };

    await this.validatePassword(userPassword, changePasswordDto.oldPassword);

    const salt = await genSalt(10);
    const hashedPassword = await hash(changePasswordDto.newPassword, salt);

    return await this.tenantService.update(user._id, {
      password: hashedPassword,
      salt,
    });
  }

  async validatePassword(
    user: { salt?: string; password?: string },
    password: string,
  ) {
    const hashedPassword = await hash(password, user.salt!);

    if (user.password !== hashedPassword) {
      throw new UnauthorizedException(
        `The credentials are not valid, please try again.`,
      );
    }

    return user.password === hashedPassword;
  }
}
