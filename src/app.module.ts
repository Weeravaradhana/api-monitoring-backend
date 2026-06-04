import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MonitorModule } from './monitor/monitor.module';
import { MonitorEngineModule } from './monitor-engine/monitor-engine.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
    }),
    MonitorModule,
    MonitorEngineModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
