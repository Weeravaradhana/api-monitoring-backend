import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMonitorMetrics(monitorId: string, range: string) {
    const startTime = this.calculateStartTime(range);

    try {
      const status = await this.prisma.monitoringResult.aggregate({
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
          monitorId: true,
        },
      });

      const totalChecks = status._count.monitorId;

      if (totalChecks === 0) {
        return {
          uptimePercentage: 100,
          averageResponseTime: 0,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
        };
      }

      const successfulCheck = await this.prisma.monitoringResult.count({
        where: {
          monitorId,
          success: true,
          checkedAt: {
            gte: startTime,
          },
        },
      });

      const failedChecked = totalChecks - successfulCheck;
      const uptimePercentage = Number(
        ((successfulCheck / totalChecks) * 100).toFixed(2),
      );
      const averageResponseTime = status._avg.responseTime
        ? Math.round(status._avg.responseTime)
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
      case '7c':
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
