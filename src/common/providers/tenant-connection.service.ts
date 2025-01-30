import {
  Injectable,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Connection, createConnection } from 'mongoose';
import { EnvConfiguration } from 'src/config';

@Injectable()
export class TenantConnectionService
  implements OnModuleDestroy, OnApplicationBootstrap
{
  private connections = new Map<
    string,
    { connection: Connection; lastUsed: number }
  >();
  private readonly maxIdleTime = 10 * 60 * 1000; // 10 minutos
  private cleanupInterval: NodeJS.Timeout;

  async getTenantConnection(
    tenantId: string,
    retries = 3,
  ): Promise<Connection> {
    const now = Date.now();

    // Si ya existe la conexión, actualiza su tiempo de uso y retorna
    if (this.connections.has(tenantId)) {
      const connectionData = this.connections.get(tenantId)!;
      connectionData.lastUsed = now;
      return connectionData.connection;
    }

    let attempt = 0;
    while (attempt < retries) {
      try {
        // Intenta crear una nueva conexión
        const connection = createConnection(
          EnvConfiguration().database.connectionString!,
          {
            dbName: `tenant_${tenantId}`,
            maxPoolSize: 10,
            minPoolSize: 1,
          },
        );

        this.connections.set(tenantId, { connection, lastUsed: now });

        return connection;
      } catch (error) {
        attempt++;
        console.error(
          `Intento ${attempt} fallido al conectar con tenant ${tenantId}:`,
          error.message,
        );

        if (attempt >= retries) {
          throw new Error(
            `No se pudo establecer conexión para tenant ${tenantId} después de ${retries} intentos.`,
          );
        }

        // Espera antes de intentar nuevamente
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`No se pudo establecer conexión para tenant ${tenantId}`);
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connectionData = this.connections.get(tenantId);
    if (connectionData) {
      try {
        await connectionData.connection.close();
        console.log(`Conexión cerrada para tenant: ${tenantId}`);
      } catch (error) {
        console.error(
          `Error al cerrar conexión para tenant ${tenantId}:`,
          error.message,
        );
      } finally {
        this.connections.delete(tenantId);
      }
    }
  }

  private cleanupConnections(): void {
    const now = Date.now();

    for (const [
      tenantId,
      { connection, lastUsed },
    ] of this.connections.entries()) {
      if (now - lastUsed > this.maxIdleTime) {
        console.log(`Cerrando conexión inactiva para tenant: ${tenantId}`);
        this.closeTenantConnection(tenantId);
      }
    }
  }

  onApplicationBootstrap() {
    // Limpieza periódica de conexiones inactivas cada 5 minutos
    this.cleanupInterval = setInterval(
      () => this.cleanupConnections(),
      5 * 60 * 1000,
    );
  }

  async onModuleDestroy() {
    // Detener la limpieza periódica y cerrar todas las conexiones
    clearInterval(this.cleanupInterval);
    for (const [tenantId] of this.connections.entries()) {
      await this.closeTenantConnection(tenantId);
    }
  }
}
