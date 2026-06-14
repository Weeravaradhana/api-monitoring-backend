import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorStatus, Prisma } from '@prisma/client';

export enum Range {
  DAY_1 = '24h',
  DAY_7 = '7d',
  DAY_30 = '30d',
}

interface DbChartResult {
  label: string;
  avgMs: number;
  totalChecks: number;
  successChecks: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMonitorMetrics(monitorId: string, range: Range, tenantId: string) {
    const monitorExists = await this.prisma.monitor.findFirst({
      where: { id: monitorId, tenantId },
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

  async getDashboardKpiAnalytics(tenantId: string) {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const monitors = await this.prisma.monitor.findMany({
        where: { tenantId },
        select: { status: true, lastState: true },
      });

      const totalCount = monitors.length;
      const activeCount = monitors.filter(
        (m) => m.status === MonitorStatus.ACTIVE,
      ).length;
      const downCount = monitors.filter((m) => m.lastState === 'DOWN').length;
      console.log('down count', downCount);

      const rawResults = await this.prisma.monitoringResult.findMany({
        where: {
          monitor: { tenantId },
          checkedAt: { gte: sevenDaysAgo },
        },
        select: {
          success: true,
          checkedAt: true,
        },
        orderBy: { checkedAt: 'asc' },
      });

      const totalCharts: { v: number }[] = [];
      const activeCharts: { v: number }[] = [];
      const downCharts: { v: number }[] = [];
      const uptimeCharts: { v: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setDate(now.getDate() - i);
        const dateString = targetDate.toDateString();

        const dayResult = rawResults.filter(
          (r) => new Date(r.checkedAt).toDateString() === dateString,
        );

        const totalChecksOnDay = dayResult.length;
        const successChecksOnDay = dayResult.filter((r) => r.success).length;
        const failedChecksOnDay = totalChecksOnDay - successChecksOnDay;

        const uptimePercentage =
          totalChecksOnDay > 0
            ? Number(((successChecksOnDay / totalChecksOnDay) * 100).toFixed(2))
            : 100;

        totalCharts.push({ v: totalCount });
        activeCharts.push({ v: successChecksOnDay > 0 ? activeCount : 0 });
        downCharts.push({ v: failedChecksOnDay });
        uptimeCharts.push({ v: uptimePercentage });
      }

      const totalDelta = totalCount - (totalCharts[0]?.v || 0);
      const activeDelta = activeCount - (activeCharts[0]?.v || 0);
      const downDelta =
        downCharts[downCharts.length - 1]?.v - (downCharts[0]?.v || 0);

      return {
        totalMonitors: {
          currentValue: totalCount,
          delta: totalDelta >= 0 ? `+${totalDelta}` : `${totalDelta}`,
          deltaPositive: totalDelta >= 0,
          chartData: totalCharts,
        },
        activeMonitors: {
          currentValue: activeCount,
          delta: activeDelta >= 0 ? `+${activeDelta}` : `${activeDelta}`,
          deltaPositive: activeDelta >= 0,
          chartData: activeCharts,
        },
        downMonitors: {
          currentValue: downCount,
          delta: downDelta <= 0 ? `${downDelta}` : `+${downDelta}`,
          deltaPositive: downDelta <= 0,
          chartData: downCharts,
        },
        averageUptime: {
          currentValue:
            uptimeCharts.length > 0
              ? `${uptimeCharts[uptimeCharts.length - 1].v}%`
              : '100%',
          delta: '+0.00%',
          deltaPositive: true,
          chartData: uptimeCharts,
        },
      };
    } catch (error) {
      this.logger.error('Error compiling dashboard KPI analytics:', error);
      throw new BadRequestException('Could not generate dashboard KPI data');
    }
  }

  async getMonitorDashboardMetrics(monitorId: string, range: Range) {
    const startTime = this.calculateStartTime(range);

    let selectDateFormat: string;
    let truncateType: 'hour' | 'day';

    if (range === Range.DAY_1) {
      selectDateFormat = 'HH24:MI';
      truncateType = 'hour';
    } else if (range === Range.DAY_7) {
      selectDateFormat = 'Dy';
      truncateType = 'day';
    } else {
      selectDateFormat = 'Mon DD';
      truncateType = 'day';
    }

    const dbCharts = await this.prisma.$queryRaw<DbChartResult[]>`
      SELECT
        to_char(date_trunc('${Prisma.raw(truncateType)}', "checkedAt"), ${selectDateFormat}) as "label",
        ROUND(AVG("responseTime")) as "avgMs",
        COUNT(*) as "totalChecks",
        COUNT(CASE WHEN "success" = true THEN 1 END) as "successChecks"
      FROM "MonitoringResult"
      WHERE "monitorId" = ${monitorId} AND "checkedAt" >= ${startTime}
      GROUP BY date_trunc('${Prisma.raw(truncateType)}', "checkedAt")
      ORDER BY 1 ASC;
    `;

    const responseTimeTrend = dbCharts.map((row) => ({
      day: row.label,
      ms: Number(row.avgMs) || 0,
    }));

    const uptimeOverTime = dbCharts.map((row) => ({
      day: row.label,
      percentage:
        Number(row.totalChecks) > 0
          ? Number(
              (
                (Number(row.successChecks) / Number(row.totalChecks)) *
                100
              ).toFixed(1),
            )
          : 100,
    }));

    const counts = await this.prisma.monitoringResult.groupBy({
      by: ['success'],
      where: { monitorId, checkedAt: { gte: startTime } },
      _count: { _all: true },
    });

    let totalSuccess = 0;
    let totalFailure = 0;
    counts.forEach((c) => {
      if (c.success) totalSuccess = c._count._all;
      else totalFailure = c._count._all;
    });

    const downtimeTimeline = await this.prisma.monitoringResult.findMany({
      where: { monitorId, success: false, checkedAt: { gte: startTime } },
      select: { checkedAt: true, errorMessage: true },
      orderBy: { checkedAt: 'desc' },
      take: 5,
    });

    return {
      charts: {
        responseTimeTrend,
        uptimeOverTime,
        successVsFailure: [
          { name: 'Success', value: totalSuccess },
          { name: 'Failure', value: totalFailure },
        ],
        downtimeTimeline: downtimeTimeline.map((d) => ({
          status: 'DOWN',
          checkedAt: d.checkedAt,
          errorMessage: d.errorMessage,
        })),
      },
    };
  }

  private calculateStartTime(range: Range) {
    const now = new Date();

    switch (range) {
      case Range.DAY_1:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case Range.DAY_7:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case Range.DAY_30:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        throw new BadRequestException(
          "Invalid range parameter. Use '24h', '7d', or '30d'.",
        );
    }
  }
}
