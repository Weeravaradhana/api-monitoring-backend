import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService, Range } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('monitor')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':id/analytics')
  async getAnalytics(
    @Param('id') monitorId: string,
    @Query('range') range: Range = Range.DAY_1,
    @GetUser('sub') userId: string,
  ) {
    return this.analyticsService.getMonitorMetrics(monitorId, range, userId);
  }

  @Get(':id/metrics')
  async getMonitorMetrics(
    @Param('id') id: string,
    @Query('range') range: Range = Range.DAY_1,
  ) {
    const data = await this.analyticsService.getMonitorDashboardMetrics(
      id,
      range,
    );
    return { responseTimeData: data };
  }
}
