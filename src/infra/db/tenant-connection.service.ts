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
    tenantName: string,
    retries = 3,
  ): Promise<Connection> {
    const now = Date.now();

    // Si ya existe la conexión, actualiza su tiempo de uso y retorna
    if (this.connections.has(tenantName)) {
      const connectionData = this.connections.get(tenantName)!;
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
            dbName: `tenant_${tenantName}`, // ← Usar prefijo tenant_
            maxPoolSize: 10,
            minPoolSize: 1,
          },
        );

        this.connections.set(tenantName, { connection, lastUsed: now });

        return connection;
      } catch (error) {
        attempt++;
        console.error(
          `Intento ${attempt} fallido al conectar con tenant ${tenantName}:`,
          error.message,
        );

        if (attempt >= retries) {
          throw new Error(
            `No se pudo establecer conexión para tenant ${tenantName} después de ${retries} intentos.`,
          );
        }

        // Espera antes de intentar nuevamente
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`No se pudo establecer conexión para tenant ${tenantName}`);
  }

  async closeTenantConnection(tenantName: string): Promise<void> {
    const connectionData = this.connections.get(tenantName);
    if (connectionData) {
      try {
        await connectionData.connection.close();
      } catch (error) {
        console.error(
          `Error al cerrar conexión para tenant ${tenantName}:`,
          error.message,
        );
      } finally {
        this.connections.delete(tenantName);
      }
    }
  }

  private cleanupConnections(): void {
    const now = Date.now();

    for (const [
      tenantName,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      { connection, lastUsed },
    ] of this.connections.entries()) {
      if (now - lastUsed > this.maxIdleTime) {
        this.closeTenantConnection(tenantName);
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
    for (const [tenantName] of this.connections.entries()) {
      await this.closeTenantConnection(tenantName);
    }
  }
}
