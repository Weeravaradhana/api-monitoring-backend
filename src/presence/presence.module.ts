import { PresenceService } from './presence.service';
import PresenceGateway from './presence.gateway';
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [PresenceService, PresenceGateway, PrismaService],
  exports: [PresenceService, PresenceGateway],
})
export class PresenceModule {}
