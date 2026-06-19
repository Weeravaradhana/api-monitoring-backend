import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorEngineExecutor } from './monitor-engine.executor';
import { Interval } from '@nestjs/schedule';
import { MonitorStatus } from '@prisma/client';

@Injectable()
export class MonitorEngineScheduler {
  private readonly logger = new Logger(MonitorEngineScheduler.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: MonitorEngineExecutor,
  ) {}

  @Interval(1000)
  async pollMonitors() {
    if (this.isPolling) {
      this.logger.warn(
        'Previous polling cycle is still active. Skipping this tick to prevent DB overhead.',
      );
      return;
    }
    this.isPolling = true;
    const now = new Date();

    try {
      const eligibleMonitors = await this.prisma.monitor.findMany({
        where: {
          status: MonitorStatus.ACTIVE,
          nextRunAt: {
            lte: now,
          },
        },
        include: {
          tenant: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (eligibleMonitors.length === 0) {
        this.isPolling = false;
        return;
      }

      this.logger.log(
        `Found ${eligibleMonitors.length} monitor(s) eligible for execution.`,
      );

      await Promise.allSettled(
        eligibleMonitors.map((monitor) => this.executor.executeJob(monitor)),
      ).then(() => {
        this.isPolling = false;
      });
    } catch (error) {
      this.logger.error(
        'Error occurred inside monitor polling scheduler:',
        error,
      );
      this.isPolling = false;
    }
  }
}
