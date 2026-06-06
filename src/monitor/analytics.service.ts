import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMonitorMetrics(monitorId: string, range: string, userId: string) {
    const monitorExists = await this.prisma.monitor.findFirst({
      where: { id: monitorId, userId },
    });

    if (!monitorExists) {
      throw new BadRequestException('Monitor not found or access denied');
    }

    const startTime = this.calculateStartTime(range);

    try {
      const groupResults = await this.prisma.monitoringResult.groupBy({
        by: ['success'],
        where: {
          monitorId,
          checkedAt: {
            gte: startTime,
          },
        },
        _avg: {
          responseTime: true,
        },
        _count: {
          _all: true,
        },
      });

      let totalChecks = 0;
      let successfulCheck = 0;
      let failedChecked = 0;
      let totalResponseTimeSum = 0;
      let responseTimeCount = 0;

      for (const group of groupResults) {
        const count = group._count._all;
        totalChecks += count;

        if (group.success) {
          successfulCheck = count;

          if (group._avg.responseTime) {
            totalResponseTimeSum += group._avg.responseTime * count;
            responseTimeCount += count;
          }
        } else {
          failedChecked = count;
        }
      }

      if (totalChecks === 0) {
        return {
          uptimePercentage: 100,
          averageResponseTime: 0,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
        };
      }

      const uptimePercentage = Number(
        ((successfulCheck / totalChecks) * 100).toFixed(2),
      );
      const averageResponseTime =
        responseTimeCount > 0
          ? Math.round(totalResponseTimeSum / responseTimeCount)
          : 0;

      return {
        uptimePercentage,
        averageResponseTime,
        totalChecks,
        successfulCheck,
        failedChecked,
      };
    } catch (error) {
      this.logger.error(
        `Error aggregating metrics for monitor ${monitorId}:`,
        error,
      );
      throw new BadRequestException('Could not retrieve analytics data');
    }
  }

  private calculateStartTime(range: string) {
    const now = new Date();

    switch (range) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        throw new BadRequestException(
          "Invalid range parameter. Use '24h', '7d', or '30d'.",
        );
    }
  }
}
