// src/events/events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    if (tenantId) {
      client.join(`tenant-${tenantId}`);
      console.log(`Client joined tenant: ${tenantId}`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect() {
    console.log('Client disconnected');
  }

  notifyTenant(tenantId: string, event: string, payload: any) {
    this.server.to(`tenant-${tenantId}`).emit(event, payload);
  }
}
