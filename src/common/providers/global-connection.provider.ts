import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Connection, createConnection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GlobalConnectionProvider implements OnModuleInit, OnModuleDestroy {
  private globalConnection: Connection;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.globalConnection = createConnection(
      this.configService.get('database.connectionString')!,
      { dbName: 'metadata', maxPoolSize: 5, minPoolSize: 1 },
    );
  }

  getConnection(): Connection {
    return this.globalConnection;
  }

  async onModuleDestroy() {
    if (this.globalConnection) {
      await this.globalConnection.close();
    }
  }
}
