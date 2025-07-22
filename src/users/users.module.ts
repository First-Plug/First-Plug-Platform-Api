import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlackModule } from 'nestjs-slack-webhook';
import { JwtModule } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAccessService } from './access/user-access.service';
import { User, UserSchema } from './schemas/user.schema';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantDbModule } from '../infra/db/tenant-db.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SlackModule,
    forwardRef(() => TenantsModule), // UserAccessService necesita TenantsService
    TenantDbModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '48h' },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserAccessService],
  exports: [UsersService, UserAccessService],
})
export class UsersModule {}
