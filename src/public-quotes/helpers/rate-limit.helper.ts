import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitHelper {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly LIMIT = 10; // 10 requests
  private readonly WINDOW = 60 * 1000; // 1 minute in milliseconds

  /**
   * Verificar si la IP ha excedido el límite de rate limiting
   * Límite: 10 requests por minuto por IP
   */
  checkRateLimit(ip: string): void {
    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry) {
      // Primera solicitud de esta IP
      this.store.set(ip, {
        count: 1,
        resetTime: now + this.WINDOW,
      });
      return;
    }

    if (now > entry.resetTime) {
      // Ventana expirada, resetear
      this.store.set(ip, {
        count: 1,
        resetTime: now + this.WINDOW,
      });
      return;
    }

    // Dentro de la ventana
    if (entry.count >= this.LIMIT) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${this.LIMIT} requests per minute allowed.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
  }

  /**
   * Limpiar entradas expiradas (ejecutar periódicamente)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(ip);
      }
    }
  }
}
