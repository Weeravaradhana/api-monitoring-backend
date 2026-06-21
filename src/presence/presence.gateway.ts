import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';

interface SocketUser {
  userId: string;
  tenantId: string;
}

interface PresenceQuery {
  userId?: string;
  tenantId?: string;
}

interface AuthenticatedSocket extends Socket {
  data: SocketUser;
}

@WebSocketGateway({
  namespace: 'presence',
  cors: { origin: '*' },
})
class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, Map<string, number>>();

  constructor(private readonly presenceService: PresenceService) {}

  async handleConnection(client: AuthenticatedSocket) {
    const { userId, tenantId } = client.handshake.query as PresenceQuery;

    if (!userId || !tenantId) return;

    client.data = { userId, tenantId };

    await client.join(tenantId);

    if (!this.onlineUsers.has(tenantId)) {
      this.onlineUsers.set(tenantId, new Map());
    }

    const tenantMap = this.onlineUsers.get(tenantId)!;

    const count = (tenantMap.get(userId) ?? 0) + 1;
    tenantMap.set(userId, count);

    if (count === 1) {
      await this.presenceService.updatePresence(tenantId, userId, true);
    }

    await this.broadcastOnlineList(tenantId);
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const { userId, tenantId } = client.data ?? {};

    if (!userId || !tenantId) return;

    const tenantMap = this.onlineUsers.get(tenantId);

    if (tenantMap) {
      const count = (tenantMap.get(userId) ?? 1) - 1;

      if (count <= 0) {
        tenantMap.delete(userId);

        await this.presenceService.updatePresence(tenantId, userId, false);
      } else {
        tenantMap.set(userId, count);
      }
    }

    await this.broadcastOnlineList(tenantId);
  }

  private async broadcastOnlineList(tenantId: string) {
    const onlineIds: string[] =
      await this.presenceService.getOnlineMemberIds(tenantId);

    this.server.to(tenantId).emit('init_online_users', onlineIds);
  }
}

export default PresenceGateway;
