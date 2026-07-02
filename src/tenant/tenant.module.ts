import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceModule } from '../presence/presence.module';
import PresenceGateway from '../presence/presence.gateway';

@Module({
  imports: [PresenceModule],
  controllers: [TenantController],
  providers: [TenantService, PrismaService, PresenceGateway],
})
export class TenantModule {}
